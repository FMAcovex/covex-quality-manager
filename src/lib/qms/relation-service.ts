import { Prisma, QmsRecordType, QmsRelationType } from "@prisma/client";
import { hasDatabaseTransaction } from "@/lib/transaction-context";
import { currentIdentity } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";
import { qmsScope } from "@/lib/auth/resources";
import { relationHooksFor } from "@/modules/relation-hooks-registry";
import type { PrismaClient } from "@prisma/client";

async function authorizeEndpoints(client: QmsRelationClient, ids: string[]) {
  const context = currentIdentity();
  if (!context || context.unitTest) return;
  for (const id of new Set(ids)) {
    if (context.createdRecords?.has(id)) continue;
    const target = await qmsScope(id, client as unknown as PrismaClient);
    assertPermission(context.principal, target.module, "EDIT", target.scope);
  }
}
import {
  canRelate,
  operationalRelationLabel,
  QmsRelationValidationError,
  selectOperationalRelationTarget,
  validateQmsRelation,
} from "@/lib/qms/relation-rules";

export type QmsRelationClient = Pick<
  Prisma.TransactionClient,
  "qmsRecord" | "qmsRelation"
> & Partial<Pick<Prisma.TransactionClient, "audit" | "auditFindingRelation" | "$queryRaw" | "complaint" | "returnRecord" | "qmsRecordVersion">>;

export type QmsRelationHistoryClient = Pick<
  Prisma.TransactionClient,
  "qmsRecord" | "qmsRelation" | "audit" | "auditFindingRelation" | "$queryRaw" | "changeHistory"
>;

export type CreateQmsRelationInput = {
  sourceRecordId: string;
  targetRecordId: string;
  relationType?: QmsRelationType;
  createdByText?: string | null;
  notes?: string | null;
};

export type LinkOperationalRelationByCodeInput = {
  currentRecordId: string;
  currentType: QmsRecordType;
  relatedType: QmsRecordType;
  businessCode: string;
  createdByText?: string | null;
  notes?: string | null;
};

export type DeactivateOperationalRelationInput = {
  currentRecordId: string;
  relatedRecordId: string;
  changedByText?: string | null;
  reason: string;
};

export type SyncOperationalOriginRelationsInput = {
  capaRecordId: string;
  originRecordIds: string[];
  changedByText?: string | null;
};

const relationRecordSelect = {
  id: true,
  recordType: true,
  businessCode: true,
  annulledBusinessCode: true,
  isActive: true,
} as const;

async function getQmsRecord(
  client: QmsRelationClient,
  id: string,
  role: "origen" | "destino",
) {
  const record = await client.qmsRecord.findUnique({
    where: { id },
    select: relationRecordSelect,
  });
  if (!record) {
    throw new QmsRelationValidationError(
      `El expediente QMS de ${role} no existe o ya no está disponible.`,
    );
  }
  if (record.isActive === false) {
    throw new QmsRelationValidationError(
      `El expediente QMS de ${role} está anulado y no puede usarse para crear nuevas relaciones.`,
    );
  }
  return record;
}

function canonicalRelationEndpoints(
  current: { id: string; recordType: QmsRecordType },
  related: { id: string; recordType: QmsRecordType },
) {
  if (
    canRelate(
      current.recordType,
      related.recordType,
      QmsRelationType.GENERATES,
    )
  ) {
    return {
      sourceRecordId: current.id,
      targetRecordId: related.id,
    };
  }
  if (
    canRelate(
      related.recordType,
      current.recordType,
      QmsRelationType.GENERATES,
    )
  ) {
    return {
      sourceRecordId: related.id,
      targetRecordId: current.id,
    };
  }
  throw new QmsRelationValidationError(
    `Relación no permitida entre ${current.recordType} y ${related.recordType}.`,
  );
}

export async function createQmsRelation(
  client: QmsRelationClient,
  input: CreateQmsRelationInput,
) {
  await authorizeEndpoints(client, [input.sourceRecordId, input.targetRecordId]);
  if (!input.sourceRecordId || !input.targetRecordId) {
    throw new QmsRelationValidationError(
      "Los identificadores QMS de origen y destino son obligatorios.",
    );
  }
  if (input.sourceRecordId === input.targetRecordId) {
    throw new QmsRelationValidationError(
      "Un expediente no puede relacionarse consigo mismo.",
    );
  }

  const [source, target] = await Promise.all([
    getQmsRecord(client, input.sourceRecordId, "origen"),
    getQmsRecord(client, input.targetRecordId, "destino"),
  ]);
  const relation = validateQmsRelation(
    source,
    target,
    input.relationType ?? QmsRelationType.GENERATES,
  );
  const transactional = hasDatabaseTransaction() || !("$transaction" in client) && Boolean(client.$queryRaw);

  const sourceHooks = relationHooksFor(source.recordType)?.asSource;
  const targetHooks = relationHooksFor(target.recordType)?.asTarget;
  const hookContext = { client, source, target, transactional };
  await sourceHooks?.beforeCreate?.(hookContext);
  await targetHooks?.beforeCreate?.(hookContext);
  const upsert = {
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: relation.sourceRecordId,
        targetRecordId: relation.targetRecordId,
        relationType: relation.relationType,
      },
    },
    // Reactiva una relación histórica sin crear otra fila y conserva su autoría.
    update: { isActive: true },
    create: {
      sourceRecordId: relation.sourceRecordId,
      targetRecordId: relation.targetRecordId,
      relationType: relation.relationType,
      createdByText: input.createdByText,
      notes:
        input.notes ??
        operationalRelationLabel(relation.sourceType, relation.targetType),
    },
  };
  let result;
  if (!transactional) {
    // Legacy standalone clients keep their atomic API. Mandatory business
    // writers pass the transaction client, never a second independent client.
    result = await client.qmsRelation.upsert(upsert);
  } else {
    if (client.$queryRaw) await client.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["COVEX-QMS-RELATION", relation.sourceRecordId, relation.targetRecordId, relation.relationType])},0))::text AS locked`);
    const previous = await client.qmsRelation.findUnique({ where: upsert.where });
    result = previous
      ? previous.isActive ? previous : await client.qmsRelation.update({ where: { id: previous.id }, data: upsert.update })
      : await client.qmsRelation.create({ data: upsert.create });
  }
  await sourceHooks?.afterCreate?.(hookContext);
  await targetHooks?.afterCreate?.(hookContext);
  return result;

}

export async function linkOperationalRelationByBusinessCode(
  client: QmsRelationClient,
  input: LinkOperationalRelationByCodeInput,
) {
  const businessCode = input.businessCode.trim();
  if (!businessCode) {
    throw new QmsRelationValidationError(
      "Debe indicarse la codificación del expediente relacionado.",
    );
  }

  const direct = canRelate(
    input.currentType,
    input.relatedType,
    QmsRelationType.GENERATES,
  );
  const inverse = canRelate(
    input.relatedType,
    input.currentType,
    QmsRelationType.GENERATES,
  );
  if (!direct && !inverse) {
    throw new QmsRelationValidationError(
      `Relación no permitida entre ${input.currentType} y ${input.relatedType}.`,
    );
  }

  const matches = await client.qmsRecord.findMany({
    where: {
      businessCode,
      recordType: input.relatedType,
      id: { not: input.currentRecordId },
    },
    select: { id: true, recordType: true, businessCode: true },
  });
  const related = selectOperationalRelationTarget(input.currentType, matches);
  const endpoints = direct
    ? {
        sourceRecordId: input.currentRecordId,
        targetRecordId: related.id,
      }
    : {
        sourceRecordId: related.id,
        targetRecordId: input.currentRecordId,
      };

  return createQmsRelation(client, {
    ...endpoints,
    createdByText: input.createdByText,
    notes: input.notes,
  });
}

export function getOutgoingRelations(
  client: QmsRelationClient,
  sourceRecordId: string,
) {
  return client.qmsRelation.findMany({
    where: { sourceRecordId, isActive: true },
    include: { targetRecord: true },
    orderBy: { createdAt: "asc" },
  });
}

export function getIncomingRelations(
  client: QmsRelationClient,
  targetRecordId: string,
) {
  return client.qmsRelation.findMany({
    where: { targetRecordId, isActive: true },
    include: { sourceRecord: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function deactivateQmsRelation(
  client: QmsRelationClient,
  input: {
    sourceRecordId: string;
    targetRecordId: string;
    relationType?: QmsRelationType;
  },
) {
  await authorizeEndpoints(client, [input.sourceRecordId, input.targetRecordId]);
  const relationType = input.relationType ?? QmsRelationType.GENERATES;
  const relation = await client.qmsRelation.findUnique({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: input.sourceRecordId,
        targetRecordId: input.targetRecordId,
        relationType,
      },
    },
    select: { id: true, isActive: true },
  });

  if (!relation) {
    throw new QmsRelationValidationError("La relación QMS ya no existe.");
  }

  if (!relation.isActive) return relation;
  const [source, target] = await Promise.all([
    client.qmsRecord.findUnique({ where: { id: input.sourceRecordId }, select: { recordType: true } }),
    client.qmsRecord.findUnique({ where: { id: input.targetRecordId }, select: { recordType: true } }),
  ]);
  const sourceHooks = source ? relationHooksFor(source.recordType)?.asSource : undefined;
  const targetHooks = target ? relationHooksFor(target.recordType)?.asTarget : undefined;
  const hookContext = { client, relationId: relation.id, sourceRecordId: input.sourceRecordId, targetRecordId: input.targetRecordId };
  await sourceHooks?.beforeDeactivate?.(hookContext);
  await targetHooks?.beforeDeactivate?.(hookContext);
  const result = await client.qmsRelation.update({where:{id:relation.id},data:{isActive:false}});
  await sourceHooks?.afterDeactivate?.(hookContext);
  await targetHooks?.afterDeactivate?.(hookContext);
  return result;
}

export async function deactivateOperationalRelation(
  client: QmsRelationHistoryClient,
  input: DeactivateOperationalRelationInput,
) {
  await authorizeEndpoints(client, [input.currentRecordId, input.relatedRecordId]);
  const [current, related] = await Promise.all([
    client.qmsRecord.findUnique({
      where: { id: input.currentRecordId },
      select: { id: true, recordType: true },
    }),
    client.qmsRecord.findUnique({
      where: { id: input.relatedRecordId },
      select: { id: true, recordType: true },
    }),
  ]);

  if (!current || !related) {
    throw new QmsRelationValidationError(
      "Uno de los expedientes relacionados ya no existe.",
    );
  }

  const endpoints = canonicalRelationEndpoints(current, related);
  const relation = await deactivateQmsRelation(client, endpoints);

  await client.changeHistory.create({
    data: {
      qmsRecordId: current.id,
      changedByText: input.changedByText,
      fieldPath: "relations",
      oldValue: {
        sourceRecordId: endpoints.sourceRecordId,
        targetRecordId: endpoints.targetRecordId,
        relationType: QmsRelationType.GENERATES,
      },
      newValue: { active: false },
      reason: input.reason,
      source: "UI",
    },
  });

  return relation;
}


export async function syncOperationalOriginRelations(
  client: QmsRelationHistoryClient,
  input: SyncOperationalOriginRelationsInput,
) {
  const uniqueOriginIds = [...new Set(input.originRecordIds.filter(Boolean))];
  const capa = await getQmsRecord(client, input.capaRecordId, "destino");
  if (capa.recordType !== QmsRecordType.CAPA) {
    throw new QmsRelationValidationError("El expediente destino debe ser una CAPA.");
  }

  const origins = uniqueOriginIds.length
    ? await client.qmsRecord.findMany({
        where: { id: { in: uniqueOriginIds } },
        select: relationRecordSelect,
      })
    : [];
  if (origins.length !== uniqueOriginIds.length) {
    throw new QmsRelationValidationError("Uno o varios expedientes de origen ya no existen.");
  }

  for (const origin of origins) {
    if (!origin.isActive) {
      throw new QmsRelationValidationError("Un expediente de origen anulado no puede vincularse a una CAPA.");
    }
    if (origin.recordType !== QmsRecordType.DEVIATION && origin.recordType !== QmsRecordType.COMPLAINT && origin.recordType !== QmsRecordType.AUDIT) {
      throw new QmsRelationValidationError("Una CAPA admite Desviación, Reclamación o Auditoría como origen.");
    }
    await createQmsRelation(client, {
      sourceRecordId: origin.id,
      targetRecordId: capa.id,
      createdByText: input.changedByText,
    });
  }

  const activeIncoming = await client.qmsRelation.findMany({
    where: {
      targetRecordId: capa.id,
      relationType: QmsRelationType.GENERATES,
      isActive: true,
      sourceRecord: {
        recordType: { in: [QmsRecordType.DEVIATION, QmsRecordType.COMPLAINT, QmsRecordType.AUDIT] },
      },
    },
    select: { id: true, sourceRecordId: true },
  });

  const selected = new Set(uniqueOriginIds);
  for (const relation of activeIncoming) {
    if (!selected.has(relation.sourceRecordId)) {
      await deactivateQmsRelation(client, { sourceRecordId: relation.sourceRecordId, targetRecordId: capa.id });
    }
  }

  return client.qmsRelation.findMany({
    where: {
      targetRecordId: capa.id,
      relationType: QmsRelationType.GENERATES,
      isActive: true,
      sourceRecord: {
        recordType: { in: [QmsRecordType.DEVIATION, QmsRecordType.COMPLAINT, QmsRecordType.AUDIT] },
      },
    },
    include: { sourceRecord: true },
    orderBy: { createdAt: "asc" },
  });
}
