import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, type AuditActionStatus, type AuditCapaPlanVersionKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalAuditJson } from "@/lib/audit/canonical-json";
import { currentIdentity } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { AuditValidationError } from "./service";
import { auditReportInclude, auditReportEvent, lockReportAudit, snapshotAudit } from "./report-service";
import { generateAuditCapaPlan } from "./documents/generators";
import { CapaPlanStaleError, capaPlanToday, capaPlanFileName, capaPlanFingerprint, capaPlanFollowupSchema, capaPlanRowProblem, capaPlanSequenceLabel, establishCapaPlanSchema, isCriticalRowChange, parseCapaPlanFollowupForm } from "./capa-plan-domain";
import { withBytes } from "@/lib/db-binary-omit";

type Tx = Prisma.TransactionClient;
const digest = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const capaPlanRequestHash = (content: Record<string, unknown>) => digest(canonicalAuditJson(content));
export type CapaPlanVersionInput = {
  kind: AuditCapaPlanVersionKind; requestId: string; requestHash: string; actor: string; reason: string;
  followupDate?: Date | null; observations?: string | null; nextReviewDate?: Date | null;
};
/** Devuelve la versión ya emitida con esta solicitud o null; otra carga con el mismo id es un error. */
export async function replayedCapaPlanVersion(tx: Tx, auditId: string, requestId: string, requestHash: string) {
  const previous = await tx.auditCapaPlanVersion.findUnique({ where: { auditId_requestId: { auditId, requestId } } });
  if (previous && previous.requestHash !== requestHash) throw new Error("Solicitud ya utilizada con otros datos. Recarga la auditoría.");
  return previous;
}
/**
 * Emite la siguiente versión del CAPA plan con su foto y su A4.03 congelado.
 * Quien llama ya tiene la auditoría bloqueada (lockReportAudit) y ha aplicado sus cambios.
 */
export async function issueCapaPlanVersion(tx: Tx, auditId: string, input: CapaPlanVersionInput) {
  const audit = await tx.audit.findUniqueOrThrow({ where: { id: auditId }, include: auditReportInclude });
  const template = await tx.templateVersion.findFirst({ where: { module: "AUDIT", documentType: "AUDIT_CAPA_PLAN", isActive: true }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }], omit: withBytes });
  if (!template?.checksum || (!template.fileData && !template.filePath)) throw new TemplateAssetError("Plantilla A4.03 del CAPA plan no instalada. Instálala en Configuración → Instalar plantillas.");
  const source = template.fileData ? Buffer.from(template.fileData) : await readFile(path.resolve(process.cwd(), template.filePath!));
  if (digest(source) !== template.checksum) throw new TemplateAssetError("La plantilla A4.03 no coincide con su checksum registrado.");
  const last = await tx.auditCapaPlanVersion.findFirst({ where: { auditId }, orderBy: { sequenceNumber: "desc" }, select: { sequenceNumber: true } });
  const sequence = last ? last.sequenceNumber + 1 : 0;
  const snapshot = snapshotAudit(audit, [{ id: template.id, documentType: template.documentType, versionCode: template.versionCode, checksum: template.checksum }]);
  const bytes = generateAuditCapaPlan(source, snapshot, sequence);
  const version = await tx.auditCapaPlanVersion.create({ data: {
    auditId, sequenceNumber: sequence, kind: input.kind, followupDate: input.followupDate ?? null, observations: input.observations || null, nextReviewDate: input.nextReviewDate ?? null,
    requestId: input.requestId, requestHash: input.requestHash, contentFingerprint: capaPlanFingerprint(snapshot), snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
    templateVersionId: template.id, templateChecksum: template.checksum, fileName: capaPlanFileName(audit.qmsRecord.businessCode ?? audit.externalReference, sequence),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileData: new Uint8Array(bytes), fileSize: bytes.length, checksum: digest(bytes), generatedBy: input.actor,
  } });
  await auditReportEvent(tx, audit.qmsRecordId, input.actor, "audit.capaPlan.version", null, { id: version.id, sequenceNumber: sequence, kind: version.kind, checksum: version.checksum }, input.reason);
  return version;
}
/** Versión 00: fija las fechas del CAPA plan y congela lo que haya, aunque esté incompleto. */
export async function establishCapaPlan(auditId: string, raw: unknown) {
  const parsed = establishCapaPlanSchema.safeParse(raw);
  if (!parsed.success) throw new AuditValidationError(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message])));
  const v = parsed.data, requestHash = capaPlanRequestHash({ kind: "ESTABLISHED", capaPlanDate: v.capaPlanDate });
  return prisma.$transaction(async tx => {
    const audit = await lockReportAudit(tx, auditId);
    const replayed = await replayedCapaPlanVersion(tx, auditId, v.requestId, requestHash);
    if (replayed) return replayed;
    if (audit.status === "DRAFT") throw new Error("Abre la auditoría antes de establecer el CAPA plan.");
    if (audit.status !== "OPEN") throw new Error("La auditoría está cerrada; no se establece el CAPA plan.");
    if (await tx.auditCapaPlanVersion.count({ where: { auditId } })) throw new Error("El CAPA plan ya está establecido (versión 00).");
    const today = day(capaPlanToday());
    const after = await tx.audit.update({ where: { id: auditId }, data: { capaPlanDate: day(v.capaPlanDate), capaPlanEstablishedAt: audit.capaPlanEstablishedAt ?? today, updatedByText: v.actor } });
    const reason = `Establecimiento del CAPA plan (versión ${capaPlanSequenceLabel(0)})`;
    for (const key of ["capaPlanDate", "capaPlanEstablishedAt"] as const) if (audit[key]?.getTime() !== after[key]?.getTime()) await auditReportEvent(tx, audit.qmsRecordId, v.actor, `audit.${key}`, audit[key], after[key], reason);
    return issueCapaPlanVersion(tx, auditId, { kind: "ESTABLISHED", requestId: v.requestId, requestHash, actor: v.actor, reason });
  }, { timeout: 20000 });
}
const iso = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const changeKeys = (before: Record<string, unknown>, after: Record<string, unknown>) => Object.keys(after).filter(key => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
/**
 * R5C2: seguimiento del CAPA plan. En una transacción actualiza las acciones y los
 * hallazgos sin acciones que cambian (con las validaciones de cierre de siempre) y
 * emite la versión siguiente con su foto y su A4.03.
 */
export async function recordCapaPlanFollowup(auditId: string, raw: Record<string, string>) {
  const form = parseCapaPlanFollowupForm(raw);
  const parsed = capaPlanFollowupSchema.safeParse(form);
  if (!parsed.success) throw new AuditValidationError(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message])));
  const v = parsed.data, { actor: _actor, ...hashed } = form, requestHash = capaPlanRequestHash({ kind: "FOLLOWUP", ...hashed });
  void _actor;
  return prisma.$transaction(async tx => {
    const audit = await lockReportAudit(tx, auditId);
    const replayed = await replayedCapaPlanVersion(tx, auditId, v.requestId, requestHash);
    if (replayed) return replayed;
    if (audit.status === "DRAFT") throw new Error("Abre la auditoría antes de registrar un seguimiento.");
    if (!await tx.auditCapaPlanVersion.count({ where: { auditId } })) throw new Error("Establece primero el CAPA plan (versión 00).");
    const findings = audit.findings.filter(f => f.isActive);
    const actions = new Map(findings.flatMap(f => f.actions.filter(a => a.isActive).map(a => [a.id, { ...a, finding: f }] as const)));
    const bare = new Map(findings.filter(f => !f.actions.some(a => a.isActive)).map(f => [f.id, f]));
    type Update = { kind: "action" | "finding"; id: string; reference: string; before: Record<string, unknown>; data: Record<string, unknown> };
    const updates: Update[] = [];
    for (const row of form.actions) {
      const before = actions.get(row.id);
      if (!before) throw new Error("Una acción del formulario ya no está activa. Recarga la auditoría.");
      const data = { status: row.status, closedAt: row.closedAt || null, targetDate: row.targetDate || null, evidenceReference: row.evidenceReference || null, evidence: row.evidence || null };
      const current = { status: before.status, closedAt: iso(before.closedAt), targetDate: iso(before.targetDate), evidenceReference: before.evidenceReference, evidence: before.evidence };
      // Solo se comprueban las filas que cambian: una fila intacta no bloquea el seguimiento.
      if (!changeKeys(current, data).length) continue;
      if (before.updatedAt.toISOString() !== row.updatedAt) throw new CapaPlanStaleError(`${before.finding.reference}: la acción cambió desde que abriste el formulario. Recarga antes de guardar.`);
      const problem = capaPlanRowProblem({ ...row, verificationComment: before.verificationComment ?? "" });
      if (problem) throw new Error(`${before.finding.reference}: ${problem}`);
      updates.push({ kind: "action", id: row.id, reference: before.finding.reference, before: current, data });
    }
    for (const row of form.findings) {
      const before = bare.get(row.id);
      if (!before) throw new Error("Un hallazgo del formulario ya no está activo o tiene acciones. Recarga la auditoría.");
      const data = { status: row.treatmentStatus, treatment: row.treatment || null, closedAt: row.closedAt || null, evidenceReference: row.evidenceReference || null, evidence: row.evidence || null };
      const current = { status: before.treatmentStatus, treatment: before.treatment, closedAt: iso(before.closedAt), evidenceReference: before.evidenceReference, evidence: before.evidence };
      if (!changeKeys(current, data).length) continue;
      if (before.updatedAt.toISOString() !== row.updatedAt) throw new CapaPlanStaleError(`${before.reference}: el hallazgo cambió desde que abriste el formulario. Recarga antes de guardar.`);
      const problem = capaPlanRowProblem({ status: row.treatmentStatus, closedAt: row.closedAt, evidence: row.evidence, evidenceReference: row.evidenceReference, verificationComment: before.verificationComment ?? "", treatment: row.treatment });
      if (problem) throw new Error(`${before.reference}: ${problem}`);
      updates.push({ kind: "finding", id: row.id, reference: before.reference, before: current, data });
    }
    if (!updates.length && !v.observations.trim()) throw new Error("No hay cambios ni observaciones que registrar.");
    const typed = (u: Update) => ({ status: String(u.before.status), closedAt: (u.before.closedAt as string | null) ?? null, evidence: (u.before.evidence as string | null) ?? null });
    const after = (u: Update) => ({ status: String(u.data.status), closedAt: (u.data.closedAt as string | null) ?? null, evidence: (u.data.evidence as string | null) ?? null });
    if (updates.some(u => isCriticalRowChange(typed(u), after(u))) && !v.changeReason.trim()) throw new Error("Indica el motivo: el seguimiento cierra, da por no aplicable, reabre, cambia una fecha de cierre o corrige una evidencia ya registrada.");
    // Cerrar exige CLOSE. La protección de entradas lo adelanta; aquí se decide sobre las filas
    // que de verdad pasan a cerrada, dentro de la transacción y con los valores normalizados.
    const context = currentIdentity();
    if (context && !context.unitTest && updates.some(u => u.data.status === "CLOSED" && u.before.status !== "CLOSED")) assertPermission(context.principal, "AUDIT", "CLOSE", context.resource);
    const reason = v.changeReason.trim() || v.observations.trim() || "Seguimiento del CAPA plan";
    const day = (s: unknown) => typeof s === "string" && s ? new Date(`${s}T00:00:00.000Z`) : null;
    for (const u of updates) {
      if (u.kind === "action") {
        const row = await tx.auditFindingAction.update({ where: { id: u.id }, data: { status: u.data.status as AuditActionStatus, closedAt: day(u.data.closedAt), targetDate: day(u.data.targetDate), evidenceReference: u.data.evidenceReference as string | null, evidence: u.data.evidence as string | null, updatedByText: v.actor } });
        await tx.changeHistory.create({ data: { qmsRecordId: audit.qmsRecordId, changedByText: v.actor, fieldPath: `audit.actions.${row.id}`, oldValue: json(u.before), newValue: json(u.data), reason, source: "UI" } });
      } else {
        const row = await tx.auditFinding.update({ where: { id: u.id }, data: { treatmentStatus: u.data.status as AuditActionStatus, treatment: u.data.treatment as string | null, closedAt: day(u.data.closedAt), evidenceReference: u.data.evidenceReference as string | null, evidence: u.data.evidence as string | null, updatedByText: v.actor } });
        await tx.changeHistory.create({ data: { qmsRecordId: audit.qmsRecordId, changedByText: v.actor, fieldPath: `audit.findings.${row.id}`, oldValue: json(u.before), newValue: json(u.data), reason, source: "UI" } });
      }
    }
    return issueCapaPlanVersion(tx, auditId, { kind: "FOLLOWUP", requestId: v.requestId, requestHash, actor: v.actor, reason, followupDate: day(v.followupDate), observations: v.observations.trim() || null, nextReviewDate: day(v.nextReviewDate) });
  }, { timeout: 20000 });
}
const listSelect = { id: true, sequenceNumber: true, kind: true, followupDate: true, observations: true, nextReviewDate: true, generatedAt: true, generatedBy: true, fileName: true, checksum: true, contentFingerprint: true } as const;
export async function listCapaPlanVersions(auditId: string) {
  return prisma.auditCapaPlanVersion.findMany({ where: { auditId }, orderBy: { sequenceNumber: "desc" }, select: listSelect });
}
export type CapaPlanVersionSummary = Awaited<ReturnType<typeof listCapaPlanVersions>>[number];
export async function getCapaPlanVersionFile(auditId: string, sequence: number) {
  const file = await prisma.auditCapaPlanVersion.findUnique({ where: { auditId_sequenceNumber: { auditId, sequenceNumber: sequence } }, omit: withBytes });
  if (!file) throw new Error("La versión del CAPA plan no existe en esta auditoría.");
  if (digest(file.fileData) !== file.checksum) throw new Error("El archivo de la versión no supera la comprobación de integridad.");
  return file;
}
