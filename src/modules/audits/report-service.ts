import { Prisma, DocumentType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AuditValidationError } from "./service";
import { reportInputSchema, reportDateFields, reportTextFields, issueReportSchema, closeAuditSchema } from "./report-validation";
import { auditClosureChecklist, type ClosureContext } from "./closure-policy";
import { auditAlreadyClosed } from "./lifecycle";

type Tx = Prisma.TransactionClient;
export const auditReportInclude = {
  departments: { orderBy: { id: "asc" as const } }, participants: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
  findings: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }], include: {
    actions: { orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }] },
    relations: { include: { qmsRelation: { include: { targetRecord: { include: { capa: { select: { status: true, effectivenessStatus: true } }, deviation: { select: { status: true } } } } } } } },
  } },
  followups: { orderBy: [{ followupDate: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }] },
  qmsRecord: { include: {
    sourceRelations: { include: { targetRecord: { select: { id: true, businessCode: true, annulledBusinessCode: true, recordType: true, isActive: true } } } },
    generatedDocuments: { select: { id: true, documentType: true, fileName: true, checksum: true, metadata: true, generatedAt: true, recordVersionId: true } },
  } },
} satisfies Prisma.AuditInclude;
export type ReportAudit = Prisma.AuditGetPayload<{ include: typeof auditReportInclude }>;
type Serialized<T> = T extends Date ? string : T extends (infer U)[] ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;
export type AuditReportSnapshot = { schemaVersion: 1; audit: Serialized<ReportAudit>; templates: { id: string; documentType: DocumentType; versionCode: string; checksum: string | null }[] };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const day = (s: string) => s ? new Date(`${s}T00:00:00.000Z`) : null;
export async function lockReportAudit(tx: Tx, id: string) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "Audit" WHERE id = ${id} FOR NO KEY UPDATE`);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = (SELECT "qmsRecordId" FROM "Audit" WHERE id = ${id}) FOR NO KEY UPDATE`);
  const a = await tx.audit.findUniqueOrThrow({ where: { id }, include: auditReportInclude });
  if (!a.qmsRecord.isActive) throw new Error("Reactiva la auditoría antes de esta operación.");
  return a;
}
export async function auditReportEvent(tx: Tx, qmsRecordId: string, actor: string, fieldPath: string, before: unknown, after: unknown, reason: string) {
  await tx.changeHistory.create({ data: { qmsRecordId, changedByText: actor, fieldPath, oldValue: json(before), newValue: json(after), reason, source: "UI" } });
}
function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const p = schema.safeParse(raw);
  if (!p.success) throw new AuditValidationError(Object.fromEntries(p.error!.issues.map(i => [String(i.path[0]), i.message])));
  return p.data;
}
export async function saveAuditReport(id: string, raw: unknown) {
  const v = parse(reportInputSchema, raw);
  return prisma.$transaction(async tx => {
    const a = await lockReportAudit(tx, id);
    if (v.expectedUpdatedAt && a.updatedAt.toISOString() !== v.expectedUpdatedAt) throw new Error("El expediente cambió. Recarga antes de guardar.");
    const versions = await tx.qmsRecordVersion.count({ where: { qmsRecordId: a.qmsRecordId } });
    if ((v.reportSentAt || v.capaPlanEstablishedAt) && !versions) throw new Error("Emite el informe antes de registrar su envío o establecer el CAPA Plan.");
    if (v.capaPlanEstablishedAt && !a.findings.filter(f => f.isActive).every(f => Boolean(f.treatment?.trim()) || f.actions.some(x => x.isActive) || f.relations.some(r => r.isActive && r.qmsRelation.isActive))) throw new Error("Establece tratamiento/acciones para todos los elementos del CAPA Plan.");
    const data = { ...Object.fromEntries(reportTextFields.map(k => [k, v[k] || null])), ...Object.fromEntries(reportDateFields.map(k => [k, day(v[k])])), responseRequired: v.responseRequired, updatedByText: v.actor };
    const after = await tx.audit.update({ where: { id }, data });
    for (const k of [...reportTextFields, ...reportDateFields, "responseRequired"] as const) if (JSON.stringify(a[k]) !== JSON.stringify(after[k])) await auditReportEvent(tx, a.qmsRecordId, v.actor, `audit.${k}`, a[k], after[k], "Edición del informe / hechos de seguimiento y cierre; sin nueva versión automática");
    return after;
  });
}
export function snapshotAudit(a: ReportAudit, templates: AuditReportSnapshot['templates']): AuditReportSnapshot {
  return JSON.parse(JSON.stringify({ schemaVersion: 1, audit: a, templates }));
}
export function readAuditSnapshot(value: Prisma.JsonValue): AuditReportSnapshot {
  const s = value as unknown as AuditReportSnapshot;
  if (s?.schemaVersion !== 1 || !s.audit?.id || !Array.isArray(s.templates)) throw new Error("Snapshot de informe no compatible; no se reconstruye con datos vivos.");
  return s;
}
export async function issueAuditReport(id: string, raw: unknown) {
  const v = parse(issueReportSchema, raw);
  return prisma.$transaction(async tx => {
    const a = await lockReportAudit(tx, id);
    if (a.status === "DRAFT") throw new Error("La emisión requiere una auditoría abierta o cerrada.");
    if (!a.reportDate || !a.conclusion?.trim() || !a.performedDate) throw new Error("Completa fecha realizada, fecha de informe y conclusión antes de emitir.");
    const received = a.scenario === "CLIENT" || a.scenario === "AUTHORITY";
    if (received && !a.qmsRecord.generatedDocuments.some(d => d.documentType === "AUDIT_RECEIVED")) throw new Error("Registra el documento externo primario antes de emitir su snapshot.");
    const last = await tx.qmsRecordVersion.findFirst({ where: { qmsRecordId: a.qmsRecordId }, orderBy: { sequenceNumber: "desc" } });
    if (last && !v.reason.trim()) throw new Error("La revisión 01+ exige motivo obligatorio.");
    const types: DocumentType[] = [DocumentType.AUDIT_CAPA_PLAN, ...(received ? [] : [a.scenario === "SUPPLIER" ? DocumentType.AUDIT_EXTERNAL_REPORT : DocumentType.AUDIT_INTERNAL_REPORT]), ...(a.scenario === "SUPPLIER" ? [DocumentType.AUDIT_EXTERNAL_PLAN] : [])];
    const templates = await tx.templateVersion.findMany({ where: { module: "AUDIT", documentType: { in: types }, isActive: true }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] });
    const selected = types.map(type => templates.find(t => t.documentType === type));
    if (selected.some(t => !t || (!t.fileData && !t.filePath) || !t.checksum)) throw new Error("Instala/revisa las plantillas controladas de este escenario antes de emitir.");
    const snapshot = snapshotAudit(a, selected.map(t => ({ id: t!.id, documentType: t!.documentType, versionCode: t!.versionCode, checksum: t!.checksum })));
    const version = await tx.qmsRecordVersion.create({ data: { qmsRecordId: a.qmsRecordId, sequenceNumber: (last?.sequenceNumber ?? -1) + 1, kind: last ? "AUDIT_REVISION" : "INITIAL", snapshot: json(snapshot), reason: v.reason || "Informe inicial", createdByText: v.actor, frozenAt: new Date() } });
    await auditReportEvent(tx, a.qmsRecordId, v.actor, "audit.report.version", null, { id: version.id, sequenceNumber: version.sequenceNumber }, version.reason!);
    return version;
  }, { timeout: 20000 });
}
export async function auditClosureContext(tx: Tx, a: ReportAudit): Promise<ClosureContext> {
  const versions = await tx.qmsRecordVersion.findMany({ where: { qmsRecordId: a.qmsRecordId }, include: { documents: { select: { kind: true } } }, orderBy: { sequenceNumber: "desc" } });
  const latestByScope = new Map<string, typeof a.followups[number]>();
  for (const f of a.followups) if (!latestByScope.has(f.findingId ?? "general")) latestByScope.set(f.findingId ?? "general", f);
  return { ...a, supplierResponseReceivedAt: a.supplierResponseReceivedAt ?? a.qmsRecord.generatedDocuments.find(d => d.documentType === "AUDIT_RESPONSE")?.generatedAt ?? null, isActive: a.qmsRecord.isActive, reportIssued: versions.length > 0, primaryDocument: a.qmsRecord.generatedDocuments.some(d => d.documentType === "AUDIT_RECEIVED"), signedPdf: Boolean(versions[0]?.documents.some(d => d.kind === "SIGNED_PDF")), pendingFollowups: [...latestByScope.values()].some(f => f.nextReviewDate && (!f.findingId || a.findings.some(x => x.id === f.findingId && x.isActive))) };
}
export async function closeAudit(id: string, raw: unknown) {
  const v = parse(closeAuditSchema, raw);
  return prisma.$transaction(async tx => {
    const a = await lockReportAudit(tx, id);
    if (auditAlreadyClosed(a.status)) throw new Error("La auditoría ya está cerrada.");
    // Keep necessary CAPA status/efficacy and administrative state stable until
    // the QA decision commits, including concurrent edits in the CAPA module.
    const capaRecordIds = [...new Set(a.findings.filter(f => f.isActive).flatMap(f => f.relations.filter(r => r.isActive && r.qmsRelation.isActive && r.qmsRelation.targetRecord.capa).map(r => r.qmsRelation.targetRecord.id)))].sort();
    for (const recordId of capaRecordIds) {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${recordId} FOR NO KEY UPDATE`);
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Capa" WHERE "qmsRecordId" = ${recordId} FOR NO KEY UPDATE`);
    }
    const current = await tx.audit.findUniqueOrThrow({ where: { id }, include: auditReportInclude });
    const checklist = auditClosureChecklist(await auditClosureContext(tx, current), v.supplierException);
    if (v.supplierException && (!v.reason || !v.verifyAtNextAudit)) checklist.blockers.push("Documenta justificación y verificación pendiente en la siguiente auditoría.");
    if (checklist.blockers.length) throw new Error(checklist.blockers.join(" "));
    const after = await tx.audit.update({ where: { id }, data: { status: "CLOSED", closedAt: day(v.closedAt), supplierException: v.supplierException, supplierExceptionReason: v.supplierException ? v.reason : null, supplierExceptionBy: v.supplierException ? v.actor : null, supplierExceptionAt: v.supplierException ? day(v.closedAt) : null, verifyAtNextAudit: v.supplierException, updatedByText: v.actor } });
    await auditReportEvent(tx, a.qmsRecordId, v.actor, "audit.closure", { status: a.status, closedAt: a.closedAt }, { status: after.status, closedAt: after.closedAt, exception: after.supplierException, reason: after.supplierExceptionReason, verifyAtNextAudit: after.verifyAtNextAudit }, v.reason || "Cierre definitivo por QA");
    return after;
  }, { timeout: 20000 });
}
