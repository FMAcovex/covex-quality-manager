import { Prisma } from "@prisma/client";
import { complaintSnapshotVersionFollowupDate, refreshCurrentVersion, serializeComplaintVersion, snapshotJson } from "@/lib/qms/versioning";

export async function lockComplaintVersion(tx: Prisma.TransactionClient, qmsRecordId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${qmsRecordId} FOR UPDATE`);
}

export function complaintVersionSource(tx: Prisma.TransactionClient, id: string) {
  return tx.complaint.findUniqueOrThrow({where:{id},include:{
    qmsRecord:{include:{sourceRelations:{where:{isActive:true,relationType:"GENERATES"},include:{targetRecord:true},orderBy:{id:"asc"}}}},
    followups:{orderBy:[{followupDate:"asc"},{createdAt:"asc"}]},
    capaPlans:{orderBy:{createdAt:"asc"},include:{linkedCapaRecord:true}},
    derivedActions:{orderBy:[{sortOrder:"asc"},{createdAt:"asc"}]},
    formVersion:true,annexIIITemplateVersion:true,annexIVTemplateVersion:true,annexVTemplateVersion:true,
  }});
}

export async function refreshComplaintRelationSnapshot(tx: Prisma.TransactionClient, qmsRecordId: string) {
  const record = await tx.complaint.findUnique({where:{qmsRecordId},select:{id:true}});
  if (!record) return;
  const latest = await tx.qmsRecordVersion.findFirst({where:{qmsRecordId},orderBy:{sequenceNumber:"desc"}});
  if (!latest) return; // Preserve historical records without artificial backfill.
  const source = await complaintVersionSource(tx, record.id);
  await refreshCurrentVersion(tx,qmsRecordId,snapshotJson(serializeComplaintVersion(source,{
    versionFollowupDate:complaintSnapshotVersionFollowupDate(latest.snapshot,latest.sequenceNumber),
  })),latest.createdByText,latest.reason);
}
