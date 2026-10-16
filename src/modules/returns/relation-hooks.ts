import type { Prisma } from "@prisma/client";
import type { ModuleRelationHooks } from "@/modules/contract";
import { QmsRelationValidationError } from "@/lib/qms/relation-errors";

export const returnRelationHooks: ModuleRelationHooks = {
  asTarget: {
    async beforeCreate({ client, source, target, transactional }) {
      if (client.returnRecord && client.$queryRaw && transactional) {
        const { lockReturn } = await import("@/modules/returns/snapshot-service");
        await lockReturn(client as Prisma.TransactionClient, target.id);
        const operational = await client.returnRecord.findUnique({ where: { qmsRecordId: target.id }, select: { status: true } });
        const complaint = client.complaint ? await client.complaint.findUnique({ where: { qmsRecordId: source.id }, select: { status: true, qmsRecord: { select: { isActive: true } } } }) : null;
        if (complaint && (complaint.status === "DRAFT" || !complaint.qmsRecord.isActive)) throw new QmsRelationValidationError("La reclamación debe estar activa y operativa para vincularse.");
        if (!operational || operational.status === "DRAFT") throw new QmsRelationValidationError("La devolución debe ser operativa para vincularse.");
      }
    },
    async afterCreate({ client, target, transactional }) {
      if (client.returnRecord && client.qmsRecordVersion && transactional) {
        const { refreshReturnSnapshot } = await import("@/modules/returns/snapshot-service");
        await refreshReturnSnapshot(client as Prisma.TransactionClient, target.id);
      }
    },
    async beforeDeactivate({ client, targetRecordId }) {
      if (client.returnRecord && client.$queryRaw && !("$transaction" in client)) {
        const { lockReturn } = await import("@/modules/returns/snapshot-service");
        await lockReturn(client as Prisma.TransactionClient, targetRecordId);
      }
    },
    async afterDeactivate({ client, targetRecordId }) {
      if (client.returnRecord && client.qmsRecordVersion && !("$transaction" in client)) {
        const { refreshReturnSnapshot } = await import("@/modules/returns/snapshot-service");
        await refreshReturnSnapshot(client as Prisma.TransactionClient, targetRecordId);
      }
    },
  },
};
