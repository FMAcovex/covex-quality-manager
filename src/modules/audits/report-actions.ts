"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { saveAuditReport, issueAuditReport, closeAudit } from "./report-service";
import { registerAuditAttachment, storeAuditSignedPdf } from "./documents/service";
export type AuditReportActionState = { error: string | null; savedHref?: string; values?: Record<string,string>; revision?: number };
const values = (fd: FormData) => Object.fromEntries([...fd.entries()].filter((entry): entry is [string,string] => typeof entry[1] === 'string'));
async function run(id: string, tab: string, previous: AuditReportActionState, fd: FormData, operation: () => Promise<unknown>): Promise<AuditReportActionState> {
  try { await operation();return {error:null,savedHref:`/audits/${id}?tab=${tab}`}; }
  catch(error){ return {error:error instanceof Error ? error.message : "No se pudo completar la operación.",values:values(fd),revision:(previous.revision ?? 0)+1}; }
}
async function saveAuditReportActionAuthenticatedContent(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'report',previous,fd,()=>saveAuditReport(id,{...values(fd),responseRequired:fd.get('responseRequired')==='on'}));}
async function issueAuditReportActionAuthenticatedContent(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'versions',previous,fd,()=>issueAuditReport(id,values(fd)));}
async function closeAuditActionAuthenticatedContent(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'report',previous,fd,()=>closeAudit(id,{...values(fd),supplierException:fd.get('supplierException')==='on',verifyAtNextAudit:fd.get('verifyAtNextAudit')==='on'}));}
async function registerAuditAttachmentActionAuthenticatedContent(id: string, previous: AuditReportActionState, fd: FormData) {return run(id,'documents',previous,fd,async()=>{
  const file=fd.get('file');if(!(file instanceof File))throw new Error("Selecciona el documento.");
  const v=values(fd);return registerAuditAttachment(id,file,{type:v.type as 'AUDIT_RECEIVED'|'AUDIT_RESPONSE'|'AUDIT_EVIDENCE',reference:v.reference ?? '',date:v.date ?? '',externalVersion:v.externalVersion ?? '',observations:v.observations ?? '',actor:v.actor ?? '',documentName:v.documentName ?? ''});
});}
async function storeAuditSignedPdfActionAuthenticatedContent(id: string, versionId: string, previous: AuditReportActionState, fd: FormData) {return run(id,'versions',previous,fd,async()=>{
  const file=fd.get('file');if(!(file instanceof File))throw new Error("Selecciona el PDF firmado.");return storeAuditSignedPdf(id,versionId,file,String(fd.get('actor') ?? ''));
});}

export async function saveAuditReportAction(...args: Parameters<typeof saveAuditReportActionAuthenticatedContent>) {
  return authorizedAction("saveAuditReportAction", args, authenticated => saveAuditReportActionAuthenticatedContent(...authenticated as Parameters<typeof saveAuditReportActionAuthenticatedContent>));
}

export async function issueAuditReportAction(...args: Parameters<typeof issueAuditReportActionAuthenticatedContent>) {
  return authorizedAction("issueAuditReportAction", args, authenticated => issueAuditReportActionAuthenticatedContent(...authenticated as Parameters<typeof issueAuditReportActionAuthenticatedContent>));
}

export async function closeAuditAction(...args: Parameters<typeof closeAuditActionAuthenticatedContent>) {
  return authorizedAction("closeAuditAction", args, authenticated => closeAuditActionAuthenticatedContent(...authenticated as Parameters<typeof closeAuditActionAuthenticatedContent>));
}

export async function registerAuditAttachmentAction(...args: Parameters<typeof registerAuditAttachmentActionAuthenticatedContent>) {
  return authorizedAction("registerAuditAttachmentAction", args, authenticated => registerAuditAttachmentActionAuthenticatedContent(...authenticated as Parameters<typeof registerAuditAttachmentActionAuthenticatedContent>));
}

export async function storeAuditSignedPdfAction(...args: Parameters<typeof storeAuditSignedPdfActionAuthenticatedContent>) {
  return authorizedAction("storeAuditSignedPdfAction", args, authenticated => storeAuditSignedPdfActionAuthenticatedContent(...authenticated as Parameters<typeof storeAuditSignedPdfActionAuthenticatedContent>));
}
