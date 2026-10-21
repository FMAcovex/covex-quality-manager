"use server";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorizedAction } from "@/lib/auth/action-guard";
import { currentIdentity } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";
import { prisma } from "@/lib/db";
import { canonicalAuditJson } from "./canonical-json";
import { assertAuditProtection, assertAuditApplicationRole } from "./protection";
import { auditTrailCutoff, exactAuditTrailOperationSelection, exactAuditTrailSelection, parseAuditTrailFilters, type AuditTrailFilters } from "./trail";
import { withBytes } from "@/lib/db-binary-omit";
import { formatAuditTrailCsvLocal } from "./display-time";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestId=(form:FormData)=>{const value=String(form.get("_covexAuditRequestId")??"");return uuid.test(value)?value:randomUUID();};
const parseFilters=(form:FormData):AuditTrailFilters=>{try{const value=JSON.parse(String(form.get("filters")??"{}"));return parseAuditTrailFilters(value&&typeof value==="object"?value:{});}catch{ /* Entrada mal formada: se trata como vacía o no válida. */ return {};}};
const idArray=(ids:string[])=>Prisma.sql`ARRAY[${Prisma.join(ids)}]::uuid[]`;
async function protectedReceipt(query:Prisma.Sql){
  return prisma.$transaction(async tx=>{
    await assertAuditProtection(tx);
    await assertAuditApplicationRole(tx);
    return tx.$queryRaw<{id:string}[]>(query);
  });
}

function cutoffFromForm(form:FormData){
  const id=String(form.get("cutoffOperationId")??""),occurredAt=new Date(String(form.get("cutoffOccurredAt")??""));
  if(!uuid.test(id)||Number.isNaN(occurredAt.valueOf()))throw new Error("El corte de revisión no es válido.");
  return {id,occurredAt};
}

async function recordReview(form:FormData){
  const actor=currentIdentity()?.principal;if(!actor)throw new Error("Sesión no disponible.");
  const filters=parseFilters(form),requestedCutoff=cutoffFromForm(form);
  const nonce=requestId(form);
  const existing=await prisma.auditTrailReview.findUnique({where:{reviewerUserId_requestId:{reviewerUserId:actor.id,requestId:nonce}}});
  const selected=form.getAll("operationId").map(String);
  // A receipt changes its own review-status filter. For replay only, resolve the
  // immutable selected events without that mutable predicate; the original
  // filters, exact IDs and command remain in the digest checked by PostgreSQL.
  const selectionFilters=existing?{...filters,review:undefined}:filters;
  const exact=await exactAuditTrailOperationSelection(selectionFilters,requestedCutoff,selected),cutoff=exact.cutoff;
  const result=String(form.get("result")??"");
  if(!["NO_OBSERVATIONS","OBSERVATIONS_RECORDED","FOLLOW_UP_REQUIRED"].includes(result))throw new Error("Selecciona un resultado de revisión válido.");
  const notes=String(form.get("notes")??"").trim();if(notes.length>4000)throw new Error("Las observaciones superan el límite permitido.");
  const supersedesId=String(form.get("supersedesId")??"").trim()||null;if(supersedesId&&!uuid.test(supersedesId))throw new Error("La referencia de rectificación no es válida.");
  const manifest={version:"COVEX_AUDIT_REVIEW_SCOPE_V1",filters,cutoff:{occurredAt:cutoff.occurredAt,operationId:cutoff.id},operationIds:exact.operationIds,eventIds:exact.eventIds,eventCount:exact.eventIds.length};
  const command={result,notes:notes||null,supersedesId,manifest};
  const digest=createHash("sha256").update(canonicalAuditJson(command)).digest("hex"),id=randomUUID();
  const rows=await protectedReceipt(Prisma.sql`SELECT covex_c_record_review(${id}::uuid,${nonce}::uuid,${digest},${actor.id}::uuid,${result},${notes},${JSON.stringify(manifest)}::jsonb,${cutoff.occurredAt}::timestamptz,${cutoff.id}::uuid,${idArray(exact.operationIds)},${idArray(exact.eventIds)},${supersedesId}::uuid) AS id`);
  revalidatePath("/audit-trail");return rows[0]?.id??id;
}

export async function recordAuditTrailReviewAction(...args:[FormData]){
  const id=await authorizedAction("recordAuditTrailReviewAction",args,authenticated=>recordReview(authenticated[0] as FormData));
  redirect(`/audit-trail?reviewed=${encodeURIComponent(id)}`);
}

const csvCell=(value:unknown)=>{
  let text=value==null?"":typeof value==="string"?value:canonicalAuditJson(value);
  if(/^[=+\-@\t\r]/.test(text))text="'"+text;
  return `"${text.replaceAll('"','""')}"`;
};
const csvRow=(values:unknown[])=>values.map(csvCell).join(",")+"\r\n";

async function createExport(form:FormData){
  const actor=currentIdentity()?.principal;if(!actor)throw new Error("Sesión no disponible.");
  const filters=parseFilters(form),nonce=requestId(form);
  if(filters.sensitive)assertPermission(actor,"SYSTEM","AUDIT_TRAIL_SENSITIVE_READ");
  const digest=createHash("sha256").update(canonicalAuditJson({version:"COVEX_AUDIT_EXPORT_COMMAND_V1",format:"CSV_UTF8",filters})).digest("hex");
  const existing=await prisma.auditTrailExport.findUnique({where:{actorUserId_requestId:{actorUserId:actor.id,requestId:nonce}},omit:withBytes});
  if(existing){
    if(existing.requestDigest!==digest)throw new Error("Export request conflict");
    if(createHash("sha256").update(existing.fileData).digest("hex")!==existing.contentSha256)throw new Error("La exportación no supera la comprobación de integridad.");
    const stored=existing.scopeManifest as {cutoff:{occurredAt:string};operationIds:string[];eventIds:string[]};
    const rows=await protectedReceipt(Prisma.sql`SELECT covex_c_record_export(${existing.id}::uuid,${nonce}::uuid,${digest},${actor.id}::uuid,${existing.format},${existing.fileName},${new Uint8Array(existing.fileData)}::bytea,${JSON.stringify(existing.scopeManifest)}::jsonb,${stored.cutoff.occurredAt}::timestamptz,${existing.cutoffOperationId}::uuid,${idArray(stored.operationIds)},${idArray(stored.eventIds)},${existing.rowCount}::integer) AS id`);
    return rows[0].id;
  }
  const requestedCutoff=await auditTrailCutoff();if(!requestedCutoff)throw new Error("No existen eventos para exportar.");
  const exact=await exactAuditTrailSelection(filters,requestedCutoff),cutoff=exact.cutoff;
  if(!exact.events.length)throw new Error("No existen eventos con los filtros indicados.");
  const operationById=new Map(exact.operations.map(operation=>[operation.id,operation]));
  const exportId=randomUUID();
  const operationIds=exact.operations.map(operation=>operation.id),eventIds=exact.events.map(event=>event.id);
  const manifest={version:"COVEX_AUDIT_EXPORT_MANIFEST_V1",format:"CSV_UTF8",filters,cutoff:{occurredAt:cutoff.occurredAt,operationId:cutoff.id},operationIds,eventIds,eventCount:eventIds.length,operationCount:operationIds.length,timezone:"UTC",localTimezone:"Europe/Madrid",policyVersions:[...new Set(exact.operations.map(operation=>operation.policyVersion))].sort(),schemaVersions:[...new Set(exact.operations.map(operation=>operation.schemaVersion))].sort(),release:process.env.APP_RELEASE_SHA??"development"};
  let csv="\uFEFF";
  csv+=csvRow(["COVEX Quality Manager","Exportación controlada de Audit Trail"]);
  csv+=csvRow(["Identificador",exportId]);csv+=csvRow(["Corte UTC",cutoff.occurredAt]);csv+=csvRow(["Corte (Madrid)",formatAuditTrailCsvLocal(new Date(cutoff.occurredAt))]);csv+=csvRow(["Operación de corte",cutoff.id]);csv+=csvRow(["Ejecutor",actor.name]);csv+=csvRow(["Filtros",canonicalAuditJson(filters)]);csv+="\r\n";
  csv+=csvRow(["Fecha UTC","Fecha (Madrid)","Operación ID","Operación","Usuario","Crítica técnica","Entidad","Entidad ID","Campo","Valor anterior tipado","Valor nuevo tipado","Motivo","Versión","Documento","SHA-256 documental"]);
  for(const event of exact.events){const operation=operationById.get(event.operationId)!;csv+=csvRow([operation.occurredAt.toISOString(),formatAuditTrailCsvLocal(operation.occurredAt),operation.id,operation.operation,operation.actorName,operation.assessment?.proposedCritical===true?"Sí":"No",event.entityType,event.entityId,event.fieldPath,event.oldValue,event.newValue,operation.reason,event.recordVersionId,event.generatedDocumentId,event.documentChecksum]);}
  const bytes=Buffer.from(csv,"utf8"),fileName=`COVEX_Audit_Trail_${cutoff.occurredAt.slice(0,10)}_${exportId.slice(0,8)}.csv`;
  const rows=await protectedReceipt(Prisma.sql`SELECT covex_c_record_export(${exportId}::uuid,${nonce}::uuid,${digest},${actor.id}::uuid,'CSV_UTF8',${fileName},${new Uint8Array(bytes)}::bytea,${JSON.stringify(manifest)}::jsonb,${cutoff.occurredAt}::timestamptz,${cutoff.id}::uuid,${idArray(operationIds)},${idArray(eventIds)},${eventIds.length}::integer) AS id`);
  return rows[0]?.id??exportId;
}

export async function createAuditTrailExportAction(...args:[FormData]){
  const id=await authorizedAction("createAuditTrailExportAction",args,authenticated=>createExport(authenticated[0] as FormData));
  redirect(`/api/audit-trail/exports/${encodeURIComponent(id)}`);
}
