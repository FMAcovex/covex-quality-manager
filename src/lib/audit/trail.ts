import "server-only";
import { Prisma, type QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AccessError, currentIdentity, type AccessModule } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";

export const auditTrailModules = ["DEVIATION","CAPA","CHANGE_CONTROL","COMPLAINT","RETURN","AUDIT","PNT"] as const;
export type AuditTrailModule = typeof auditTrailModules[number];
export type AuditTrailFilters = {
  module?: AuditTrailModule;
  record?: string;
  actor?: string;
  operation?: string;
  from?: string;
  to?: string;
  critical?: "YES"|"NO";
  reason?: "WITH"|"WITHOUT";
  review?: "REVIEWED"|"UNREVIEWED"|"OBSERVATION";
  sensitive?: boolean;
};

export type TrailEvent = {
  id:string; entityType:string; entityId:string; fieldPath:string;
  oldValue:unknown; newValue:unknown; capturedAt:Date;
  recordVersionId:string|null; generatedDocumentId:string|null; documentChecksum:string|null;
};
export type TrailOperation = {
  id:string; actorName:string; operation:string; reason:string|null; policyVersion:string;
  schemaVersion:number; occurredAt:Date; accessModule:string|null; accessPermission:string|null;
  critical:boolean|null; aggregateSequence:bigint|null; rootKeys:string[];
  events:TrailEvent[]; reviews:Array<{id:string;result:string;reviewerName:string;createdAt:Date}>;
};

const clean = (value: string | undefined, max = 160) => value?.trim().slice(0,max) || undefined;
const date = (value: string | undefined, end = false) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const result = new Date(`${value}T${end?"23:59:59.999":"00:00:00.000"}Z`);
  return Number.isNaN(result.valueOf()) ? undefined : result;
};
export function parseAuditTrailFilters(input: Record<string,string|undefined>): AuditTrailFilters {
  const moduleFilter = auditTrailModules.includes(input.module as AuditTrailModule) ? input.module as AuditTrailModule : undefined;
  return {
    module:moduleFilter, record:clean(input.record), actor:clean(input.actor), operation:clean(input.operation,80),
    from:date(input.from)?.toISOString(), to:date(input.to,true)?.toISOString(),
    critical:input.critical==="YES"||input.critical==="NO"?input.critical:undefined,
    reason:input.reason==="WITH"||input.reason==="WITHOUT"?input.reason:undefined,
    review:["REVIEWED","UNREVIEWED","OBSERVATION"].includes(input.review??"")?input.review as AuditTrailFilters["review"]:undefined,
    sensitive:input.sensitive==="1",
  };
}

function principal() {
  const user=currentIdentity()?.principal;
  if(!user) throw new AccessError(401);
  return user;
}
function mayReadSensitive() {
  try { assertPermission(principal(),"SYSTEM","AUDIT_TRAIL_SENSITIVE_READ"); return true; }
  catch(error){ if(error instanceof AccessError)return false; throw error; }
}
function aggregateWhere(filters:AuditTrailFilters):Prisma.AuditAggregateCursorWhereInput {
  if(filters.sensitive) return {rootKey:{startsWith:"ADMINISTRATION:"}};
  const business:Prisma.AuditAggregateCursorWhereInput[]=[];
  if(!filters.module||filters.module==="PNT") business.push({controlledDocumentId:{not:null},...(filters.record?{controlledDocument:{is:{OR:[{baseCode:{contains:filters.record,mode:"insensitive"}},{id:/^[0-9a-f-]{36}$/i.test(filters.record)?filters.record:undefined}]}}}: {})});
  if(!filters.module||filters.module!=="PNT") business.push({qmsRecordId:{not:null},qmsRecord:{is:{...(filters.module?{recordType:filters.module as QmsRecordType}:{}),...(filters.record?{OR:[{businessCode:{contains:filters.record,mode:"insensitive"}},{annulledBusinessCode:{contains:filters.record,mode:"insensitive"}},...(/^[0-9a-f-]{36}$/i.test(filters.record)?[{id:filters.record}]:[])]}: {})}}});
  return {OR:business};
}
function operationWhere(filters:AuditTrailFilters,rootKey?:string,cutoff?:{occurredAt:string;id:string}):Prisma.AuditOperationWhereInput {
  const root=rootKey?{rootKey}:{root:aggregateWhere(filters)};
  return {
    targets:{some:root},
    ...(filters.actor?{actorName:{contains:filters.actor,mode:"insensitive"}}:{}),
    ...(filters.operation?{operation:{contains:filters.operation,mode:"insensitive"}}:{}),
    ...(filters.from||filters.to?{occurredAt:{...(filters.from?{gte:new Date(filters.from)}:{}),...(filters.to?{lte:new Date(filters.to)}:{})}}:{}),
    ...(filters.critical?{assessment:{is:{proposedCritical:filters.critical==="YES"}}}:{}),
    ...(filters.reason==="WITH"?{reason:{not:null}}:filters.reason==="WITHOUT"?{reason:null}:{}),
    ...(filters.review==="REVIEWED"?{trailReviews:{some:{}}}:filters.review==="UNREVIEWED"?{trailReviews:{none:{}}}:filters.review==="OBSERVATION"?{trailReviews:{some:{review:{result:{in:["OBSERVATIONS_RECORDED","FOLLOW_UP_REQUIRED"]}}}}}:{}),
    ...(cutoff?{OR:[{occurredAt:{lt:cutoff.occurredAt}},{occurredAt:cutoff.occurredAt,id:{lte:cutoff.id}}]}:{}),
  };
}
function eventRootWhere(filters:AuditTrailFilters,rootKey?:string):Prisma.AuditEventWhereInput {
  const target=rootKey?{rootKey}:{root:aggregateWhere(filters)};
  return {OR:[{target},{additionalTargets:{some:{target}}}]};
}

export async function auditTrailCutoff() {
  const [row]=await prisma.$queryRaw<{occurredAt:Date;id:string}[]>`SELECT "occurredAt",id FROM "AuditOperation" ORDER BY "occurredAt" DESC,id DESC LIMIT 1`;
  return row??null;
}

// Date loses PostgreSQL microseconds. Resolve the immutable operation's exact
// timestamp, checking that the submitted millisecond timestamp identifies it.
// Never round the upper bound: later operations in that millisecond stay out.
async function exactCutoff(cutoff:{occurredAt:Date;id:string}) {
  const [row]=await prisma.$queryRaw<{occurredAt:string;id:string}[]>(Prisma.sql`
    SELECT to_char("occurredAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "occurredAt",id
    FROM "AuditOperation"
    WHERE id=${cutoff.id}::uuid AND date_trunc('milliseconds',"occurredAt")=${cutoff.occurredAt}::timestamptz`);
  if(!row)throw new AccessError(403);
  return row;
}

export async function queryAuditTrail(filters:AuditTrailFilters,{page=1,pageSize=20,rootKey}:{page?:number;pageSize?:number;rootKey?:string}={}) {
  const user=principal();
  if(rootKey?.startsWith("QMS_RECORD:")) {
    const record=await prisma.qmsRecord.findUnique({where:{id:rootKey.slice(11)},select:{recordType:true}});
    if(!record)throw new AccessError(403);assertPermission(user,record.recordType as AccessModule,"READ");
  } else if(rootKey?.startsWith("PNT:")) assertPermission(user,"PNT","READ");
  else assertPermission(user,"DEVIATION","READ");
  if(filters.sensitive&&!mayReadSensitive())throw new AccessError(403);
  page=Math.max(1,Math.floor(page));pageSize=Math.min(50,Math.max(1,Math.floor(pageSize)));
  const where=operationWhere(filters,rootKey);
  const [rows,total]=await Promise.all([
    prisma.auditOperation.findMany({where,orderBy:[{occurredAt:"desc"},{id:"desc"}],skip:(page-1)*pageSize,take:pageSize,include:{assessment:true,targets:{where:rootKey?{rootKey}:{root:aggregateWhere(filters)},select:{rootKey:true,aggregateSequence:true}},trailReviews:{include:{review:{select:{id:true,result:true,reviewerName:true,createdAt:true}}},orderBy:{review:{createdAt:"desc"}}}}}),
    prisma.auditOperation.count({where}),
  ]);
  const ids=rows.map(row=>row.id);
  const events=ids.length?await prisma.auditEvent.findMany({where:{operationId:{in:ids},...eventRootWhere(filters,rootKey)},orderBy:[{operationId:"asc"},{eventOrdinal:"asc"}],select:{id:true,operationId:true,entityType:true,entityId:true,fieldPath:true,oldValue:true,newValue:true,capturedAt:true,recordVersionId:true,generatedDocumentId:true,documentChecksum:true}}):[];
  const byOperation=new Map<string,typeof events>();
  for(const event of events)byOperation.set(event.operationId,[...(byOperation.get(event.operationId)??[]),event]);
  const operations:TrailOperation[]=rows.map(row=>({id:row.id,actorName:row.actorName,operation:row.operation,reason:row.reason,policyVersion:row.policyVersion,schemaVersion:row.schemaVersion,occurredAt:row.occurredAt,accessModule:row.accessModule,accessPermission:row.accessPermission,critical:row.assessment?.proposedCritical??null,aggregateSequence:row.targets[0]?.aggregateSequence??null,rootKeys:row.targets.map(t=>t.rootKey),events:(byOperation.get(row.id)??[]).map(event=>({id:event.id,entityType:event.entityType,entityId:event.entityId,fieldPath:event.fieldPath,oldValue:event.oldValue,newValue:event.newValue,capturedAt:event.capturedAt,recordVersionId:event.recordVersionId,generatedDocumentId:event.generatedDocumentId,documentChecksum:event.documentChecksum})),reviews:[...new Map(row.trailReviews.map(link=>[link.review.id,link.review])).values()]}));
  return {operations,total,page,pageSize,hasNext:page*pageSize<total};
}

export async function legacyTrail(rootKey:string) {
  const user=principal();
  if(rootKey.startsWith("QMS_RECORD:")) {
    const id=rootKey.slice(11),record=await prisma.qmsRecord.findUnique({where:{id},select:{recordType:true,history:{where:{auditEvidence:{none:{}}},orderBy:[{changedAt:"desc"},{id:"desc"}],take:25,select:{id:true,changedAt:true,changedByText:true,fieldPath:true,oldValue:true,newValue:true,reason:true,source:true}},versions:{orderBy:{sequenceNumber:"desc"},take:25,select:{id:true,sequenceNumber:true,kind:true,reason:true,createdByText:true,source:true,frozenAt:true,createdAt:true}}}});
    if(!record)throw new AccessError(403);assertPermission(user,record.recordType as AccessModule,"READ");
    return {history:record.history,versions:record.versions};
  }
  if(rootKey.startsWith("PNT:")) {
    assertPermission(user,"PNT","READ");const id=rootKey.slice(4);
    const record=await prisma.controlledDocument.findUnique({where:{id},select:{changes:{where:{auditEvidence:{none:{}}},orderBy:[{changedAt:"desc"},{id:"desc"}],take:25,select:{id:true,changedAt:true,changedByText:true,action:true,oldValue:true,newValue:true,reason:true,source:true}},revisions:{orderBy:{revisionCode:"desc"},take:25,select:{id:true,revisionCode:true,status:true,registeredByText:true,registeredAt:true,sourceMetadata:true}}}});
    if(!record)throw new AccessError(403);
    return {history:record.changes.map(change=>({...change,fieldPath:change.action})),versions:record.revisions.map(revision=>({id:revision.id,sequenceNumber:revision.revisionCode,kind:revision.status,reason:null,createdByText:revision.registeredByText,source:revision.sourceMetadata?"IMPORT":"UI",frozenAt:null,createdAt:revision.registeredAt}))};
  }
  throw new AccessError(403);
}

export async function exactAuditTrailSelection(filters:AuditTrailFilters,cutoff:{occurredAt:Date;id:string},limit=10000) {
  if(filters.sensitive&&!mayReadSensitive())throw new AccessError(403);
  const boundary=await exactCutoff(cutoff);
  const operations=await prisma.auditOperation.findMany({where:operationWhere(filters,undefined,boundary),orderBy:[{occurredAt:"asc"},{id:"asc"}],take:5001,select:{id:true,actorName:true,operation:true,reason:true,policyVersion:true,schemaVersion:true,occurredAt:true,assessment:{select:{proposedCritical:true}},targets:{where:{root:aggregateWhere(filters)},select:{rootKey:true,aggregateSequence:true}}}});
  if(operations.length>5000)throw new Error("El alcance supera 5.000 operaciones; acota los filtros.");
  const ids=operations.map(operation=>operation.id);
  const events=ids.length?await prisma.auditEvent.findMany({where:{operationId:{in:ids},...eventRootWhere(filters)},orderBy:[{capturedAt:"asc"},{operationId:"asc"},{eventOrdinal:"asc"}],take:limit+1,select:{id:true,operationId:true,entityType:true,entityId:true,fieldPath:true,oldValue:true,newValue:true,capturedAt:true,recordVersionId:true,generatedDocumentId:true,documentChecksum:true}}):[];
  if(events.length>limit)throw new Error(`El alcance supera ${limit.toLocaleString("es-ES")} eventos; acota los filtros.`);
  const used=new Set(events.map(event=>event.operationId));
  return {operations:operations.filter(operation=>used.has(operation.id)),events,cutoff:boundary};
}

export async function exactAuditTrailOperationSelection(filters:AuditTrailFilters,cutoff:{occurredAt:Date;id:string},operationIds:string[]) {
  if(filters.sensitive&&!mayReadSensitive())throw new AccessError(403);
  const unique=[...new Set(operationIds)].sort();
  if(!unique.length||unique.length>500||unique.some(id=>!/^[0-9a-f-]{36}$/i.test(id)))throw new AccessError(403);
  const boundary=await exactCutoff(cutoff);
  const operations=await prisma.auditOperation.findMany({where:{...operationWhere(filters,undefined,boundary),id:{in:unique}},orderBy:[{occurredAt:"asc"},{id:"asc"}],select:{id:true}});
  if(operations.length!==unique.length)throw new AccessError(403);
  const events=await prisma.auditEvent.findMany({where:{operationId:{in:unique},...eventRootWhere(filters)},orderBy:[{operationId:"asc"},{eventOrdinal:"asc"}],select:{id:true,operationId:true}});
  if(!events.length||new Set(events.map(event=>event.operationId)).size!==unique.length)throw new AccessError(403);
  return {operationIds:operations.map(operation=>operation.id),eventIds:events.map(event=>event.id),cutoff:boundary};
}
