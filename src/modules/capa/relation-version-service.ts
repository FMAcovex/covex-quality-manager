import type { Prisma } from "@prisma/client";
import { capaSnapshotVersionFollowupDate, refreshCurrentVersion, serializeCapaVersion, snapshotJson } from "@/lib/qms/versioning";

export async function refreshCapaVersionAfterRelationChange(
  tx: Prisma.TransactionClient,
  capaId: string,
  actor: string,
) {
  const capa = await tx.capa.findUniqueOrThrow({
    where: { id: capaId },
    include: {
      qmsRecord: {
        include: {
          targetRelations: {
            where: { isActive: true, relationType: "GENERATES" },
            include: { sourceRecord: true, auditFindingRelations: { where: { isActive: true }, include: { finding: { select: { id: true, reference: true } } } } },
          },
        },
      },
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });
  const currentVersion = await tx.qmsRecordVersion.findFirst({
    where: { qmsRecordId: capa.qmsRecordId },
    orderBy: { sequenceNumber: "desc" },
  });
  if (!currentVersion) return;

  const versionFollowupDate =
    capaSnapshotVersionFollowupDate(
      currentVersion.snapshot,
      currentVersion.sequenceNumber,
    ) ?? (currentVersion.sequenceNumber === 0 ? capa.openedAt : null);

  await refreshCurrentVersion(
    tx,
    capa.qmsRecordId,
    snapshotJson(serializeCapaVersion(capa, { versionFollowupDate })),
    actor,
    null,
  );
}

export async function refreshCapaOriginSnapshot(tx: Prisma.TransactionClient, qmsRecordId: string, actor: string) {
  const capa = await tx.capa.findUnique({where:{qmsRecordId},select:{id:true}});
  if (capa) await refreshCapaVersionAfterRelationChange(tx,capa.id,actor);
}
