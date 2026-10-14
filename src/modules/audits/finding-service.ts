import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createQmsRelation, deactivateOperationalRelation } from "@/lib/qms/relation-service";
import { refreshCapaOriginSnapshot } from "@/modules/capa/relation-version-service";
import { AuditValidationError } from "./service";
import { findingInputSchema, findingActionInputSchema, followupInputSchema, retirementInputSchema } from "./finding-validation";
import { nextFindingReference } from "./finding-domain";
import type { z } from "zod";

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const nullable = (s: string) => s || null;
const day = (s: string) => s ? new Date(`${s}T00:00:00.000Z`) : null;
function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new AuditValidationError(Object.fromEntries(result.error.issues.map(i => [String(i.path[0]), i.message])));
  return result.data;
}
async function lockAudit(tx: Prisma.TransactionClient, auditId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Audit" WHERE id = ${auditId} FOR UPDATE`);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = (SELECT "qmsRecordId" FROM "Audit" WHERE id = ${auditId}) FOR UPDATE`);
  const audit = await tx.audit.findUnique({ where: { id: auditId }, include: { qmsRecord: true } });
  if (!audit) throw new Error("La auditoría no existe.");
  if (!audit.qmsRecord.isActive) throw new Error("Reactiva la auditoría antes de modificarla.");
  return audit;
}
async function ownedFinding(tx: Prisma.TransactionClient, auditId: string, id: string, active = true) {
  const finding = await tx.auditFinding.findUnique({ where: { id } });
  if (!finding || finding.auditId !== auditId) throw new Error("El hallazgo no pertenece a la auditoría.");
  if (active && !finding.isActive) throw new Error("El hallazgo está retirado.");
  return finding;
}
function checkRevision(before: { updatedAt: Date }, expected?: string) {
  if (expected && expected !== before.updatedAt.toISOString()) throw new Error("El registro cambió desde que abriste el formulario. Recarga antes de guardar.");
}
async function event(tx: Prisma.TransactionClient, qmsRecordId: string, actor: string, fieldPath: string, before: unknown, after: unknown, reason: string) {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  await tx.changeHistory.create({ data: { qmsRecordId, changedByText: actor, fieldPath, oldValue: json(before), newValue: json(after), reason, source: "UI" } });
}
function valuesOnly(v: Record<string, unknown>) { return Object.fromEntries(Object.entries(v).filter(([key]) => !["updatedAt", "createdAt", "updatedByText", "sortOrder"].includes(key))); }
export async function saveAuditFinding(auditId: string, raw: unknown, findingId?: string) {
  const v = parse(findingInputSchema, raw);
  return prisma.$transaction(async tx => {
    const audit = await lockAudit(tx, auditId);
    const before = findingId ? await ownedFinding(tx, auditId, findingId) : null;
    if (before) checkRevision(before, v.expectedUpdatedAt);
    const reserved = before ? [] : await tx.auditFinding.findMany({ where: { auditId }, select: { reference: true } });
    const data = { findingType: v.findingType, criticality: v.criticality, description: v.description, criterionReference: nullable(v.criterionReference), objectiveEvidence: nullable(v.objectiveEvidence), treatment: nullable(v.treatment), treatmentStatus: v.treatmentStatus, closedAt: day(v.closedAt), evidence: nullable(v.evidence), evidenceReference: nullable(v.evidenceReference), verificationComment: nullable(v.verificationComment), sortOrder: v.sortOrder, updatedByText: v.actor };
    const after = before ? await tx.auditFinding.update({ where: { id: before.id }, data }) : await tx.auditFinding.create({ data: { ...data, auditId, reference: nextFindingReference(v.findingType, reserved.map(r => r.reference)), createdByText: v.actor } });
    await event(tx, audit.qmsRecordId, v.actor, `audit.findings.${after.id}`, before ? valuesOnly(before) : null, valuesOnly(after), v.changeReason || (before ? "Edición de hallazgo / criticidad / tratamiento" : "Alta de hallazgo"));
    return after;
  });
}
export async function saveAuditFindingAction(auditId: string, findingId: string, raw: unknown, actionId?: string) {
  const v = parse(findingActionInputSchema, raw);
  return prisma.$transaction(async tx => {
    const audit = await lockAudit(tx, auditId); await ownedFinding(tx, auditId, findingId);
    const before = actionId ? await tx.auditFindingAction.findUnique({ where: { id: actionId } }) : null;
    if (actionId && (!before || before.findingId !== findingId || !before.isActive)) throw new Error("La acción no pertenece al hallazgo activo.");
    if (before) checkRevision(before, v.expectedUpdatedAt);
    if (v.verificationResult && v.verificationResult !== "PENDING" && (!v.verifiedAt || !v.verifiedBy || (!v.evidence && !v.evidenceReference && !v.verificationComment))) throw new Error("La verificación requiere fecha, responsable y evidencia/justificación.");
    const data = { ...(v.verificationResult ? { verificationResult: v.verificationResult, verifiedAt: day(v.verifiedAt ?? ""), verifiedBy: nullable(v.verifiedBy ?? "") } : {}), description: v.description, responsible: nullable(v.responsible), targetDate: day(v.targetDate), status: v.status, closedAt: day(v.closedAt), evidence: nullable(v.evidence), evidenceReference: nullable(v.evidenceReference), verificationComment: nullable(v.verificationComment), sortOrder: v.sortOrder, updatedByText: v.actor };
    const after = before ? await tx.auditFindingAction.update({ where: { id: before.id }, data }) : await tx.auditFindingAction.create({ data: { ...data, findingId, createdByText: v.actor } });
    await event(tx, audit.qmsRecordId, v.actor, `audit.actions.${after.id}`, before ? valuesOnly(before) : null, valuesOnly(after), v.changeReason || "Alta / edición / cierre / reapertura de acción");
    return after;
  });
}
export async function retireAuditElement(auditId: string, findingId: string, raw: unknown, actionId?: string) {
  const v = parse(retirementInputSchema, raw);
  return prisma.$transaction(async tx => {
    const audit = await lockAudit(tx, auditId); const finding = await ownedFinding(tx, auditId, findingId, false);
    const data = { isActive: false, retiredAt: new Date(), retiredByText: v.actor, retirementReason: v.reason };
    if (actionId) {
      const before = await tx.auditFindingAction.findUnique({ where: { id: actionId } });
      if (!before || before.findingId !== findingId) throw new Error("La acción no pertenece al hallazgo.");
      if (!before.isActive) return before;
      const after = await tx.auditFindingAction.update({ where: { id: actionId }, data });
      await event(tx, audit.qmsRecordId, v.actor, `audit.actions.${actionId}.retirement`, before, after, v.reason); return after;
    }
    if (!finding.isActive) return finding;
    // Attribution and followup rows remain available: retirement is not global unlinking.
    const after = await tx.auditFinding.update({ where: { id: findingId }, data });
    await event(tx, audit.qmsRecordId, v.actor, `audit.findings.${findingId}.retirement`, finding, after, v.reason); return after;
  });
}
export async function saveAuditFollowup(auditId: string, raw: unknown, followupId?: string) {
  const v = parse(followupInputSchema, raw);
  return prisma.$transaction(async tx => {
    const audit = await lockAudit(tx, auditId);
    const before = followupId ? await tx.auditFollowup.findUnique({ where: { id: followupId } }) : null;
    if (followupId && (!before || before.auditId !== auditId)) throw new Error("El seguimiento no pertenece a esta auditoría.");
    if (before) checkRevision(before, v.expectedUpdatedAt);
    if (v.findingId) await ownedFinding(tx,auditId,v.findingId, before?.findingId !== v.findingId);
    const data = { findingId: v.findingId || null, followupDate: day(v.followupDate)!, completedByText: v.completedByText, description: v.description, nextReviewDate: day(v.nextReviewDate), evidenceReference: nullable(v.evidenceReference), updatedByText: v.actor };
    const after = before ? await tx.auditFollowup.update({ where: { id: before.id }, data }) : await tx.auditFollowup.create({ data: { ...data, auditId, createdByText: v.actor } });
    await event(tx, audit.qmsRecordId, v.actor, `audit.followups.${after.id}`, before ? valuesOnly(before) : null, valuesOnly(after), v.changeReason || "Seguimiento de auditoría / hallazgo"); return after;
  });
}
export async function linkAuditFinding(auditId: string, findingId: string, targetRecordId: string, actor: string) {
  parse(retirementInputSchema, { actor, reason: "Vinculación" });
  return prisma.$transaction(async tx => {
    const audit = await lockAudit(tx, auditId); await ownedFinding(tx, auditId, findingId);
    if (audit.status === "DRAFT") throw new Error("Abre la auditoría antes de vincular expedientes.");
    const target = await tx.qmsRecord.findUnique({ where: { id: targetRecordId }, include: { capa: { select: { status: true } }, deviation: { select: { status: true } } } });
    if (!target || !target.isActive || !["DEVIATION", "CAPA"].includes(target.recordType) || target.capa?.status === "DRAFT" || target.deviation?.status === "DRAFT") throw new Error("Selecciona una Desviación o CAPA operativa, existente y activa.");
    const existing = await tx.qmsRelation.findUnique({ where: { sourceRecordId_targetRecordId_relationType: { sourceRecordId: audit.qmsRecordId, targetRecordId, relationType: "GENERATES" } } });
    const relation = await createQmsRelation(tx, { sourceRecordId: audit.qmsRecordId, targetRecordId, createdByText: actor });
    if (!existing?.isActive) await event(tx, audit.qmsRecordId, actor, "relations", existing, relation, "Auditoría genera expediente existente");
    const before = await tx.auditFindingRelation.findUnique({ where: { findingId_qmsRelationId: { findingId, qmsRelationId: relation.id } } });
    if (before?.isActive) throw new Error("El expediente ya está atribuido a este hallazgo.");
    const after = before
      ? await tx.auditFindingRelation.update({ where: { id: before.id }, data: { isActive: true, updatedByText: actor, retiredAt: null, retiredByText: null, retirementReason: null } })
      : await tx.auditFindingRelation.create({ data: { findingId, qmsRelationId: relation.id, createdByText: actor } });
    await event(tx, audit.qmsRecordId, actor, `audit.attributions.${after.id}`, before, after, "Atribución de expediente a hallazgo"); await refreshCapaOriginSnapshot(tx,targetRecordId,actor); return after;
  });
}
export async function retireAuditAttribution(auditId: string, findingId: string, attributionId: string, raw: unknown) {
  const v = parse(retirementInputSchema, raw);
  return prisma.$transaction(async tx => {
    const audit = await lockAudit(tx, auditId); await ownedFinding(tx, auditId, findingId, false);
    const before = await tx.auditFindingRelation.findUnique({ where: { id: attributionId }, include: { qmsRelation: true } });
    if (!before || before.findingId !== findingId || before.qmsRelation.sourceRecordId !== audit.qmsRecordId) throw new Error("La atribución no pertenece a este hallazgo/auditoría.");
    if (!before.isActive) return before;
    const after = await tx.auditFindingRelation.update({ where: { id: attributionId }, data: { isActive: false, retiredAt: new Date(), retiredByText: v.actor, retirementReason: v.reason, updatedByText: v.actor } });
    await event(tx, audit.qmsRecordId, v.actor, `audit.attributions.${attributionId}`, before, after, v.reason); await refreshCapaOriginSnapshot(tx,before.qmsRelation.targetRecordId,v.actor); return after;
  });
}
export async function unlinkAuditRecord(auditId: string, targetRecordId: string, raw: unknown) {
  const v = parse(retirementInputSchema, raw);
  return prisma.$transaction(async tx => {
    const audit = await lockAudit(tx, auditId);
    const result = await deactivateOperationalRelation(tx, { currentRecordId: audit.qmsRecordId, relatedRecordId: targetRecordId, changedByText: v.actor, reason: v.reason });
    await refreshCapaOriginSnapshot(tx,targetRecordId,v.actor); return result;
  });
}
