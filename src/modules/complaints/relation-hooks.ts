import type { Prisma } from "@prisma/client";
import type { ModuleRelationHooks } from "@/modules/contract";

export const complaintRelationHooks: ModuleRelationHooks = {
  asSource: {
    async beforeCreate({ client, source, transactional }) {
      if (client.complaint && client.qmsRecordVersion && client.$queryRaw && transactional) {
        const { lockComplaintVersion } = await import("@/modules/complaints/version-service");
        await lockComplaintVersion(client as Prisma.TransactionClient, source.id);
      }
    },
    async afterCreate({ client, source, transactional }) {
      if (client.complaint && client.qmsRecordVersion && transactional) {
        const { refreshComplaintRelationSnapshot } = await import("@/modules/complaints/version-service");
        await refreshComplaintRelationSnapshot(client as Prisma.TransactionClient, source.id);
      }
    },
    async beforeDeactivate({ client, sourceRecordId }) {
      if (client.complaint && client.qmsRecordVersion && client.$queryRaw && !("$transaction" in client)) {
        const { lockComplaintVersion } = await import("@/modules/complaints/version-service");
        await lockComplaintVersion(client as Prisma.TransactionClient, sourceRecordId);
      }
    },
    async afterDeactivate({ client, sourceRecordId }) {
      if (client.complaint && client.qmsRecordVersion && !("$transaction" in client)) {
        const { refreshComplaintRelationSnapshot } = await import("@/modules/complaints/version-service");
        await refreshComplaintRelationSnapshot(client as Prisma.TransactionClient, sourceRecordId);
      }
    },
  },
};
