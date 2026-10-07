import { Prisma, QmsRecordType, QmsRelationType } from "@prisma/client";
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
> & Partial<Pick<Prisma.TransactionClient, "audit" | "auditFindingRelation" | "$queryRaw">>;

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

  if (source.recordType === "AUDIT") {
    await lockAuditOrigin(client, source.id);
    await client.$queryRaw!(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${target.id} FOR UPDATE`);
    const [audit, operationalTarget] = await Promise.all([
      client.audit!.findUnique({ where: { qmsRecordId: source.id }, select: { status: true, qmsRecord: { select: { isActive: true } } } }),
      client.qmsRecord.findUnique({ where: { id: target.id }, select: { isActive: true, capa: { select: { status: true } }, deviation: { select: { status: true } } } }),
    ]);
    if (!audit || !audit.qmsRecord.isActive || audit.status === "DRAFT" || !operationalTarget?.isActive || (!operationalTarget.capa && !operationalTarget.deviation) || operationalTarget.capa?.status === "DRAFT" || operationalTarget.deviation?.status === "DRAFT") throw new QmsRelationValidationError("Auditoría y destino deben ser expedientes operativos y activos.");
  }
  return client.qmsRelation.upsert({
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
  });
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

async function lockAuditOrigin(client: QmsRelationClient, sourceRecordId: string) {
  if (!client.audit || !client.auditFindingRelation || !client.$queryRaw) throw new QmsRelationValidationError("La operación de Auditoría requiere el cliente transaccional completo.");
  await client.$queryRaw!(Prisma.sql`SELECT id FROM "Audit" WHERE "qmsRecordId" = ${sourceRecordId} FOR UPDATE`);
  await client.$queryRaw!(Prisma.sql`SELECT id FROM "QmsRecord" WHERE id = ${sourceRecordId} FOR UPDATE`);
}

export async function deactivateQmsRelation(
  client: QmsRelationClient,
  input: {
    sourceRecordId: string;
    targetRecordId: string;
    relationType?: QmsRelationType;
  },
) {
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
  const source = await client.qmsRecord.findUnique({ where: { id: input.sourceRecordId }, select: { recordType: true } });
  if (source?.recordType === "AUDIT") {
    await lockAuditOrigin(client, input.sourceRecordId);
    if (await client.auditFindingRelation!.count({ where: { qmsRelationId: relation.id, isActive: true } })) throw new QmsRelationValidationError("Retira primero todas las atribuciones a hallazgos desde la Auditoría.");
  }

  return client.qmsRelation.update({
    where: { id: relation.id },
    data: { isActive: false },
  });
}

export async function deactivateOperationalRelation(
  client: QmsRelationHistoryClient,
  input: DeactivateOperationalRelationInput,
) {
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
