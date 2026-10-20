import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateAnnualProgramme } from "./generator";
import { issueProgrammeSchema, modalityText, programmeApproversSchema, programmeDocumentTypes, programmeDownloadName, programmeFingerprint, programmeReferences, type ProgrammeContent } from "./domain";
import { withBytes } from "@/lib/db-binary-omit";

const digest = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const dateText = (d: Date | null) => d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
async function readPreview(tx: Prisma.TransactionClient, planId: string) {
  const plan = await tx.auditAnnualPlan.findUniqueOrThrow({ where: { id: planId }, include: {
    entries: { include: { department: true, audit: { include: { qmsRecord: true } } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }] },
  } });
  const warnings: string[] = [];
  const entries = plan.entries.filter(e => e.isActive && (!e.audit || e.audit.planningStatus === "PLANNED"));
  const excluded = plan.entries.length - entries.length;
  if (excluded) warnings.push(`${excluded} entradas retiradas o con expediente no clasificado como planificado quedan excluidas.`);
  const content: ProgrammeContent = {
    schemaVersion: 1, planId, year: plan.year, auditType: plan.auditType, title: plan.title,
    reference: programmeReferences[plan.auditType], technicalApproverName: plan.technicalApproverName || "", qualityApproverName: plan.qualityApproverName || "", warnings,
    rows: entries.map(e => {
      const audit = e.audit;
      const execution = audit && audit.qmsRecord.isActive && audit.status !== "DRAFT" ? audit : null;
      if (audit && !audit.qmsRecord.isActive) warnings.push(`Expediente inactivo en ${e.subject}: no se incluyen fechas de ejecución.`);
      if (audit?.status === "DRAFT") warnings.push(`Expediente en borrador en ${e.subject}: no se incluyen fechas de ejecución.`);
      if (plan.auditType === "EXTERNAL" && (!e.productService || !e.plannedScope || !e.programmeArea)) warnings.push(`Revisar producto/servicio, alcance y ámbito de ${e.subject}.`);
      return {
        entryId: e.id, auditId: audit?.id ?? null, subject: e.subject, target: e.targetName || e.department?.name || "",
        area: e.programmeArea || "", productService: e.productService || "", scope: e.plannedScope || "", modality: e.plannedModality ? modalityText[e.plannedModality] : "",
        planned: e.plannedPeriodText || dateText(e.plannedDate), auditors: e.plannedAuditorsText || "",
        performed: dateText(execution?.performedDate ?? null), partial: dateText(plan.auditType === "INTERNAL" ? execution?.capaPlanEstablishedAt ?? null : execution?.reportSentAt ?? null),
        notes: e.notes || "", auditStatus: audit?.status ?? null, auditActive: audit?.qmsRecord.isActive ?? null,
      };
    }),
  };
  if (plan.auditType === "EXTERNAL") {
    const groups = new Map<string, typeof content.rows>();
    for (const row of content.rows) groups.set(row.area || "Sin especificar", [...(groups.get(row.area || "Sin especificar") || []), row]);
    content.rows = [...groups.values()].flat();
  }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const template = await tx.templateVersion.findFirst({ where: { module: "AUDIT", documentType: programmeDocumentTypes[plan.auditType], isActive: true, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    select: { id: true, versionCode: true, checksum: true, fileSize: true },
  });
  const blockers: string[] = [];
  if (!template?.checksum || !template.fileSize) blockers.push("Plantilla oficial vigente no instalada.");
  if (!entries.length) blockers.push("El programa debe contener al menos una auditoría planificada.");
  if (!content.qualityApproverName || (plan.auditType === "INTERNAL" && !content.technicalApproverName)) blockers.push("Cumplimenta los nombres de los aprobadores; las firmas y fechas se completarán en Word.");
  content.rows.forEach((r, i) => { if (!r.target || !r.planned || !r.auditors) blockers.push(`Entrada ${i + 1}: faltan entidad/departamento, fecha/período o auditores previstos.`); });
  const fingerprint = programmeFingerprint({ ...content, template: template ? { id: template.id, checksum: template.checksum } : null });
  return { content, blockers, fingerprint, template };
}
export async function getProgrammePreview(planId: string) {
  const result = await prisma.$transaction(tx => readPreview(tx, planId), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  // Never send the full template binary through server component props.
  return { content: result.content, blockers: result.blockers, fingerprint: result.fingerprint, template: result.template ? { id: result.template.id, versionCode: result.template.versionCode } : null };
}
export async function listProgrammeVersions(planId: string) {
  return prisma.auditAnnualProgrammeVersion.findMany({ where: { planId }, orderBy: { sequenceNumber: "desc" }, select: { id: true, sequenceNumber: true, generatedAt: true, generatedBy: true, reason: true, reference: true, fileName: true, checksum: true, contentFingerprint: true } });
}
export async function saveProgrammeApprovers(planId: string, input: unknown) {
  const v = programmeApproversSchema.parse(input);
  return prisma.$transaction(async tx => {
    const before = await tx.auditAnnualPlan.findUniqueOrThrow({ where: { id: planId } });
    const names = { technicalApproverName: before.auditType === "INTERNAL" ? v.technicalApproverName || null : null, qualityApproverName: v.qualityApproverName || null };
    await tx.auditAnnualPlan.update({ where: { id: planId }, data: { ...names, updatedByText: v.actor } });
    await tx.auditPlanChange.create({ data: { planId, event: "PROGRAMME_APPROVERS_UPDATED", actor: v.actor, reason: v.reason, oldValue: json({ technicalApproverName: before.technicalApproverName, qualityApproverName: before.qualityApproverName }), newValue: json(names) } });
  });
}
export async function issueAnnualProgramme(planId: string, input: unknown) {
  const v = issueProgrammeSchema.parse(input), requestHash = digest(JSON.stringify(v));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "AuditAnnualPlan" WHERE "id" = ${planId} FOR UPDATE`;
        const previousRequest = await tx.auditAnnualProgrammeVersion.findUnique({ where: { planId_requestId: { planId, requestId: v.requestId } }, omit: withBytes });
        if (previousRequest) {
          if (previousRequest.requestHash !== requestHash) throw Error("Solicitud de emisión ya utilizada con otros datos. Recarga el plan.");
          return previousRequest;
        }
        const preview = await readPreview(tx, planId);
        if (preview.fingerprint !== v.expectedFingerprint) throw Error("La planificación, la ejecución o la plantilla han cambiado. Recarga y revisa antes de emitir.");
        if (preview.blockers.length) throw Error(preview.blockers.join(" "));
        const previous = await tx.auditAnnualProgrammeVersion.findFirst({ where: { planId }, orderBy: { sequenceNumber: "desc" }, select: { sequenceNumber: true } });
        const sequence = previous ? previous.sequenceNumber + 1 : 0;
        if (sequence > 0 && !v.reason) throw Error("Indica el motivo de la nueva emisión.");
        const template = preview.template!;
        // Read the large binary only during issuance, never while rendering a plan preview.
        const storedTemplate = await tx.templateVersion.findUnique({
          where: { id: template.id },
          select: { fileData: true, checksum: true },
        });
        if (!storedTemplate?.fileData || storedTemplate.checksum !== template.checksum) throw Error("La plantilla no coincide con su checksum registrado.");
        const source = Buffer.from(storedTemplate.fileData);
        if (digest(source) !== template.checksum) throw Error("La plantilla no coincide con su checksum registrado.");
        const bytes = generateAnnualProgramme(source, preview.content);
        const generatedAt = new Date();
        const version = await tx.auditAnnualProgrammeVersion.create({ data: {
          planId, sequenceNumber: sequence, requestId: v.requestId, requestHash, contentFingerprint: preview.fingerprint,
          snapshot: json({ content: preview.content, template: { id: template.id, version: template.versionCode, checksum: template.checksum }, generatedAt, generatedBy: v.actor, reason: v.reason || "Emisión inicial" }),
          templateVersionId: template.id, templateChecksum: template.checksum!, reference: preview.content.reference,
          generatedAt, generatedBy: v.actor, reason: v.reason || "Emisión inicial", fileName: programmeDownloadName(preview.content.auditType, preview.content.year, sequence),
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileData: new Uint8Array(bytes), fileSize: bytes.length, checksum: digest(bytes),
        } });
        await tx.auditAnnualPlan.update({ where: { id: planId }, data: { updatedByText: v.actor } });
        await tx.auditPlanChange.create({ data: { planId, event: "PROGRAMME_ISSUED", actor: v.actor, reason: version.reason, newValue: json({ versionId: version.id, sequenceNumber: sequence, checksum: version.checksum }) } });
        // D-112: la emisión devuelve el Word emitido con los bytes que acaba de guardar (sin releerlos).
        return { ...version, fileData: new Uint8Array(bytes) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || (e.code === "P2010" && e.meta?.code === "40001")) && attempt < 2) continue;
      throw e;
    }
  }
  throw Error("No se pudo completar la emisión concurrente. Recarga y vuelve a intentarlo.");
}
export async function getAnnualProgrammeFile(planId: string, versionId: string) {
  const file = await prisma.auditAnnualProgrammeVersion.findFirst({ where: { planId, id: versionId }, omit: withBytes });
  if (!file) throw Error("Emisión no encontrada en este plan.");
  if (digest(Buffer.from(file.fileData)) !== file.checksum) throw Error("El archivo histórico no supera la comprobación de integridad.");
  return file;
}
