import { Prisma, QmsRelationType } from "@prisma/client";
import {
  operationalRelationLabel,
  QmsRelationValidationError,
  validateQmsRelation,
} from "@/lib/qms/relation-rules";

export type QmsRelationClient = Pick<
  Prisma.TransactionClient,
  "qmsRecord" | "qmsRelation"
>;

export type CreateQmsRelationInput = {
  sourceRecordId: string;
  targetRecordId: string;
  relationType?: QmsRelationType;
  createdByText?: string | null;
  notes?: string | null;
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
  if (!record.isActive) {
    throw new QmsRelationValidationError(
      `El expediente QMS de ${role} está anulado y no puede usarse para crear nuevas relaciones.`,
    );
  }
  return record;
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
