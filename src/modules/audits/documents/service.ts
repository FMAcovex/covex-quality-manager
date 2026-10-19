import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { retainSignedOriginal } from "@/lib/qms/signed-custody-service";
import { documentCommand } from "@/lib/audit/document-command";
import { resourceScope } from "@/lib/auth/resources";
import { currentIdentity } from "@/lib/auth/context";
import { validateSignedPdfMetadata, safeSignedPdfFileName } from "@/lib/qms/signed-version-document";
import { TemplateAssetError } from "@/modules/configuration/template-assets";
import { auditReportInclude, lockReportAudit, auditReportEvent, readAuditSnapshot, snapshotAudit } from "../report-service";
import { generateAuditReport, generateAuditCapaPlan, generateAuditExternalPlan } from "./generators";
import { validateAuditAttachment } from "./attachment-validation";
import { auditDocumentBlocker } from "./availability";
const digest = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const types: DocumentType[] = [DocumentType.AUDIT_INTERNAL_REPORT, DocumentType.AUDIT_EXTERNAL_REPORT, DocumentType.AUDIT_CAPA_PLAN, DocumentType.AUDIT_EXTERNAL_PLAN];
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function generateAuditDocument(auditId: string, type: DocumentType, sequence: number | null, actor: string) {
  actor = currentIdentity()?.principal.name ?? actor;
  if (!types.includes(type)) throw new Error("Tipo documental no generable.");
  const scope = await resourceScope("AUDIT", auditId);
  if (!scope.id) throw Error("Auditoría no disponible");
  const id = await documentCommand("AUDIT", { ...scope, id: scope.id }, { auditId, type, sequence }, () => prisma.$transaction(async tx => {
    const a = await lockReportAudit(tx, auditId);
    const blocker = auditDocumentBlocker({ status: a.status, type, sequence });
    if (blocker) throw new Error(blocker);
    const version = sequence === null ? null : await tx.qmsRecordVersion.findUnique({ where: { qmsRecordId_sequenceNumber: { qmsRecordId: a.qmsRecordId, sequenceNumber: sequence } } });
    if (sequence !== null && !version) throw new Error("La versión no existe en este expediente.");
    const snapshot = version ? readAuditSnapshot(version.snapshot) : snapshotAudit(a, []);
    const scenario = snapshot.audit.scenario;
    if ((type === "AUDIT_INTERNAL_REPORT" && !scenario?.startsWith("INTERNAL")) || ((type === "AUDIT_EXTERNAL_REPORT" || type === "AUDIT_EXTERNAL_PLAN") && scenario !== "SUPPLIER")) throw new Error("El documento no aplica al escenario de esta versión.");
    // Retained signed PDFs share the report's documentType and version. They
    // must never satisfy a request for the generated Word/XLSX original.
    const generatedMime=type==="AUDIT_CAPA_PLAN"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (version) {
      const existing = await tx.generatedDocument.findFirst({ where: { recordVersionId: version.id, documentType: type, mimeType:generatedMime, fileData: { not: null } }, orderBy: { generatedAt: "asc" } });
      if (existing) { if (!existing.checksum || digest(existing.fileData!) !== existing.checksum) throw new Error("El documento histórico no coincide con su checksum."); return existing; }
    }
    const pinned = snapshot.templates.find(t => t.documentType === type);
    const template = version ? pinned ? await tx.templateVersion.findUnique({ where: { id: pinned.id } }) : null : await tx.templateVersion.findFirst({ where: { module: "AUDIT", documentType: type, isActive: true }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] });
    if (!template || template.module !== "AUDIT" || template.documentType !== type || !template.checksum) throw new TemplateAssetError("Plantilla controlada no disponible para este documento/versión.");
    const bytes = template.fileData ? Buffer.from(template.fileData) : template.filePath ? await readFile(path.resolve(process.cwd(), template.filePath)) : null;
    if (!bytes || digest(bytes) !== template.checksum || (pinned && pinned.checksum !== template.checksum)) throw new TemplateAssetError("El binario no coincide con la plantilla congelada; no se regenera con una revisión diferente.");
    const output = type === "AUDIT_CAPA_PLAN" ? generateAuditCapaPlan(bytes, snapshot, sequence) : type === "AUDIT_EXTERNAL_PLAN" ? generateAuditExternalPlan(bytes, snapshot) : generateAuditReport(bytes, snapshot, sequence!);
    const xlsx = type === "AUDIT_CAPA_PLAN", fileName = safeSignedPdfFileName(`${snapshot.audit.qmsRecord.businessCode ?? snapshot.audit.externalReference ?? auditId}_${type}_${sequence === null ? 'actual' : String(sequence).padStart(2,'0')}.${xlsx ? 'xlsx' : 'docx'}`);
    const document = await tx.generatedDocument.create({ data: { qmsRecordId: a.qmsRecordId, recordVersionId: version?.id, documentType: type, templateVersionId: template.id, fileData: new Uint8Array(output), fileName, mimeType: xlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", checksum: digest(output), generatedByText: actor, metadata: json({ source: "GENERATED", version: sequence, templateChecksum: template.checksum, currentState: sequence === null }) } });
    await auditReportEvent(tx, a.qmsRecordId, actor, "audit.document.generated", null, { id: document.id, fileName, version: sequence, templateVersionId: template.id }, "Generación desde snapshot formal / estado actual indicado");
    return document;
  }, { timeout: 20000 }));
  return prisma.generatedDocument.findUniqueOrThrow({ where: { id } });
}
export async function registerAuditAttachment(auditId: string, file: File, metadata: { type: "AUDIT_RECEIVED" | "AUDIT_RESPONSE" | "AUDIT_EVIDENCE"; reference: string; date: string; externalVersion: string; observations: string; actor: string; documentName: string }) {
  if (!metadata.actor.trim() || !metadata.documentName.trim()) throw new Error("Indica tipo/nombre documental y responsable.");
  if (!['AUDIT_RECEIVED','AUDIT_RESPONSE','AUDIT_EVIDENCE'].includes(metadata.type)) throw new Error("Tipo de adjunto no permitido.");
  if (metadata.type === 'AUDIT_RECEIVED' && (!metadata.reference.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.date) || Number.isNaN(Date.parse(metadata.date)) || new Date(metadata.date).toISOString().slice(0,10)!==metadata.date)) throw new Error("El documento primario requiere referencia y fecha válidas.");
  if (file.size <= 0 || file.size > 15*1024*1024) throw new Error("El adjunto debe tener entre 1 byte y 15 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = validateAuditAttachment(file.name, file.type, bytes);
  return prisma.$transaction(async tx => {
    const a = await lockReportAudit(tx, auditId);
    if (a.status === 'DRAFT') throw new Error("Abre el expediente antes de registrar documentación formal.");
    const document = await tx.generatedDocument.create({ data: { qmsRecordId: a.qmsRecordId, documentType: metadata.type, fileName: safeSignedPdfFileName(file.name), fileData: bytes, mimeType, checksum: digest(bytes), generatedByText: metadata.actor, metadata: json({ ...metadata, source: "RECEIVED" }) } });
    await auditReportEvent(tx,a.qmsRecordId,metadata.actor,"audit.document.received",null,{ id:document.id, fileName:document.fileName, checksum:document.checksum, ...metadata },"Documento recibido/adjunto conservado, sin reemplazar históricos");
    return document;
  });
}
export async function storeAuditSignedPdf(auditId: string, versionId: string, file: File, actor: string) {
  const error = validateSignedPdfMetadata(file.name,file.size);
  if(error)throw new Error(error);
  if(!actor.trim())throw new Error("Indica quién carga el PDF.");
  const bytes=new Uint8Array(await file.arrayBuffer());validateAuditAttachment(file.name,file.type,bytes);
  return prisma.$transaction(async tx=>{
    const a=await lockReportAudit(tx,auditId);
    if(a.status==='DRAFT')throw new Error("El PDF requiere un informe emitido.");
    const version=await tx.qmsRecordVersion.findFirst({where:{id:versionId,qmsRecordId:a.qmsRecordId}});
    if(!version)throw new Error("La versión no pertenece a esta auditoría.");
    if(await tx.recordVersionDocument.findUnique({where:{recordVersionId_kind:{recordVersionId:versionId,kind:'SIGNED_PDF'}}}))throw new Error("Esta versión ya conserva un PDF firmado; no se sobrescribe. Emite una revisión formal si procede.");
    const fileName=safeSignedPdfFileName(file.name);
    const custody=await retainSignedOriginal(tx,{recordVersionId:versionId,kind:'SIGNED_PDF',bytes,fileName,actor,expectedChecksum:null,replacementReason:''});
    const d=await tx.recordVersionDocument.create({data:{recordVersionId:versionId,kind:'SIGNED_PDF',fileName,mimeType:'application/pdf',fileData:bytes,fileSize:file.size,checksum:digest(bytes),uploadedByText:actor,custodyId:custody.custodyId}});
    await auditReportEvent(tx,a.qmsRecordId,actor,"audit.document.signed",null,{id:d.id,recordVersionId:versionId,sequence:version.sequenceNumber,checksum:d.checksum},"Carga de PDF firmado externamente para esta versión");return d;
  });
}
export async function getAuditDocument(auditId: string, documentId: string, signed = false) {
  const a=await prisma.audit.findUniqueOrThrow({where:{id:auditId},select:{qmsRecordId:true}});
  const d=signed ? await prisma.recordVersionDocument.findFirst({where:{id:documentId,recordVersion:{qmsRecordId:a.qmsRecordId}}}) : await prisma.generatedDocument.findFirst({where:{id:documentId,qmsRecordId:a.qmsRecordId}});
  if(!d?.fileData)throw new Error("Documento no disponible en este expediente.");
  if(d.checksum && digest(d.fileData)!==d.checksum)throw new Error("El archivo no coincide con su checksum.");return d;
}
export async function getAuditReportView(id: string) {
  const audit=await prisma.audit.findUnique({where:{id},include:auditReportInclude});
  if(!audit)return null;
  const versions=await prisma.qmsRecordVersion.findMany({where:{qmsRecordId:audit.qmsRecordId},include:{documents:{select:{id:true,kind:true,fileName:true,uploadedAt:true}},generatedDocuments:{select:{id:true,documentType:true,fileName:true,generatedAt:true}}},orderBy:{sequenceNumber:'desc'}});
  const {auditClosureContext}=await import('../report-service');
  const closure=await prisma.$transaction(tx=>auditClosureContext(tx,audit));
  return {audit,versions,closure};
}
