"use server";
import { saveAuditReport, issueAuditReport, closeAudit } from "./report-service";
import { registerAuditAttachment, storeAuditSignedPdf } from "./documents/service";
export type AuditReportActionState = { error: string | null; savedHref?: string; values?: Record<string,string>; revision?: number };
const values = (fd: FormData) => Object.fromEntries([...fd.entries()].filter((entry): entry is [string,string] => typeof entry[1] === 'string'));
async function run(id: string, tab: string, previous: AuditReportActionState, fd: FormData, operation: () => Promise<unknown>): Promise<AuditReportActionState> {
  try { await operation();return {error:null,savedHref:`/audits/${id}?tab=${tab}`}; }
  catch(error){ return {error:error instanceof Error ? error.message : "No se pudo completar la operación.",values:values(fd),revision:(previous.revision ?? 0)+1}; }
}
export async function saveAuditReportAction(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'report',previous,fd,()=>saveAuditReport(id,{...values(fd),responseRequired:fd.get('responseRequired')==='on'}));}
export async function issueAuditReportAction(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'versions',previous,fd,()=>issueAuditReport(id,values(fd)));}
export async function closeAuditAction(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'report',previous,fd,()=>closeAudit(id,{...values(fd),supplierException:fd.get('supplierException')==='on',verifyAtNextAudit:fd.get('verifyAtNextAudit')==='on'}));}
export async function registerAuditAttachmentAction(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'documents',previous,fd,async()=>{
  const file=fd.get('file');if(!(file instanceof File))throw new Error("Selecciona el documento.");
  const v=values(fd);return registerAuditAttachment(id,file,{type:v.type as 'AUDIT_RECEIVED'|'AUDIT_RESPONSE'|'AUDIT_EVIDENCE',reference:v.reference ?? '',date:v.date ?? '',externalVersion:v.externalVersion ?? '',observations:v.observations ?? '',actor:v.actor ?? '',documentName:v.documentName ?? ''});
});}
export async function storeAuditSignedPdfAction(id: string, versionId: string, previous: AuditReportActionState, fd: FormData) {return run(id,'versions',previous,fd,async()=>{
  const file=fd.get('file');if(!(file instanceof File))throw new Error("Selecciona el PDF firmado.");return storeAuditSignedPdf(id,versionId,file,String(fd.get('actor') ?? ''));
});}
