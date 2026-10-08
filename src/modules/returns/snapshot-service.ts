import { Prisma } from "@prisma/client";
import { refreshCurrentVersion, serializeReturnVersion, snapshotJson } from "@/lib/qms/versioning";

export async function lockReturn(tx:Prisma.TransactionClient,qmsRecordId:string){
 await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id=${qmsRecordId} FOR UPDATE`);
}
export function returnSnapshotSource(tx:Prisma.TransactionClient,id:string){
 return tx.returnRecord.findUniqueOrThrow({where:{id},include:{qmsRecord:{include:{targetRelations:{where:{isActive:true,relationType:"GENERATES"},include:{sourceRecord:true},orderBy:{id:"asc"}}}},products:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},followups:{orderBy:[{followupDate:"asc"},{createdAt:"asc"},{id:"asc"}]},formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true,annexVITemplateVersion:true}});
}
export async function refreshReturnSnapshot(tx:Prisma.TransactionClient,qmsRecordId:string){
 const record=await tx.returnRecord.findUnique({where:{qmsRecordId},select:{id:true}});
 const version=await tx.qmsRecordVersion.findFirst({where:{qmsRecordId},orderBy:{sequenceNumber:"desc"}});
 if(!record||!version)return; // No invented backfill for untouched historical records.
 await refreshCurrentVersion(tx,qmsRecordId,snapshotJson(serializeReturnVersion(await returnSnapshotSource(tx,record.id))),version.createdByText,version.reason);
}
