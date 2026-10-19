import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, type AuditCapaPlanVersionKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canonicalAuditJson } from "@/lib/audit/canonical-json";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { AuditValidationError } from "./service";
import { auditReportInclude, auditReportEvent, lockReportAudit, snapshotAudit } from "./report-service";
import { generateAuditCapaPlan } from "./documents/generators";
import { capaPlanFileName, capaPlanFingerprint, capaPlanSequenceLabel, establishCapaPlanSchema } from "./capa-plan-domain";

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
  const template = await tx.templateVersion.findFirst({ where: { module: "AUDIT", documentType: "AUDIT_CAPA_PLAN", isActive: true }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] });
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
    const today = day(new Date().toISOString().slice(0, 10));
    const after = await tx.audit.update({ where: { id: auditId }, data: { capaPlanDate: day(v.capaPlanDate), capaPlanEstablishedAt: audit.capaPlanEstablishedAt ?? today, updatedByText: v.actor } });
    const reason = `Establecimiento del CAPA plan (versión ${capaPlanSequenceLabel(0)})`;
    for (const key of ["capaPlanDate", "capaPlanEstablishedAt"] as const) if (audit[key]?.getTime() !== after[key]?.getTime()) await auditReportEvent(tx, audit.qmsRecordId, v.actor, `audit.${key}`, audit[key], after[key], reason);
    return issueCapaPlanVersion(tx, auditId, { kind: "ESTABLISHED", requestId: v.requestId, requestHash, actor: v.actor, reason });
  }, { timeout: 20000 });
}
const listSelect = { id: true, sequenceNumber: true, kind: true, followupDate: true, observations: true, nextReviewDate: true, generatedAt: true, generatedBy: true, fileName: true, checksum: true, contentFingerprint: true } as const;
export async function listCapaPlanVersions(auditId: string) {
  return prisma.auditCapaPlanVersion.findMany({ where: { auditId }, orderBy: { sequenceNumber: "desc" }, select: listSelect });
}
export type CapaPlanVersionSummary = Awaited<ReturnType<typeof listCapaPlanVersions>>[number];
export async function getCapaPlanVersionFile(auditId: string, sequence: number) {
  const file = await prisma.auditCapaPlanVersion.findUnique({ where: { auditId_sequenceNumber: { auditId, sequenceNumber: sequence } } });
  if (!file) throw new Error("La versión del CAPA plan no existe en esta auditoría.");
  if (digest(file.fileData) !== file.checksum) throw new Error("El archivo de la versión no supera la comprobación de integridad.");
  return file;
}
