import { Prisma } from "@prisma/client";
import type { ModuleRelationHooks } from "@/modules/contract";
import type { QmsRelationClient } from "@/lib/qms/relation-service";
import { QmsRelationValidationError } from "@/lib/qms/relation-errors";

async function lockAuditOrigin(client: QmsRelationClient, sourceRecordId: string) {
  if (!client.audit || !client.auditFindingRelation || !client.$queryRaw) throw new QmsRelationValidationError("La operación de Auditoría requiere el cliente transaccional completo.");
  await client.$queryRaw!(Prisma.sql`SELECT id FROM "Audit" WHERE "qmsRecordId" = ${sourceRecordId} FOR UPDATE`);
  await client.$queryRaw!(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${sourceRecordId} FOR UPDATE`);
}

export const auditRelationHooks: ModuleRelationHooks = {
  asSource: {
    async beforeCreate({ client, source, target }) {
      await lockAuditOrigin(client, source.id);
      await client.$queryRaw!(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${target.id} FOR UPDATE`);
      const [audit, operationalTarget] = await Promise.all([
        client.audit!.findUnique({ where: { qmsRecordId: source.id }, select: { status: true, qmsRecord: { select: { isActive: true } } } }),
        client.qmsRecord.findUnique({ where: { id: target.id }, select: { isActive: true, capa: { select: { status: true } }, deviation: { select: { status: true } } } }),
      ]);
      if (!audit || !audit.qmsRecord.isActive || !operationalTarget?.isActive || (!operationalTarget.capa && !operationalTarget.deviation)) throw new QmsRelationValidationError("Auditoría y destino deben ser expedientes activos (Desviación o CAPA).");
    },
    async beforeDeactivate({ client, relationId, sourceRecordId }) {
      await lockAuditOrigin(client, sourceRecordId);
      if (await client.auditFindingRelation!.count({ where: { qmsRelationId: relationId, isActive: true } })) throw new QmsRelationValidationError("Retira primero todas las atribuciones a hallazgos desde la Auditoría.");
    },
  },
};
