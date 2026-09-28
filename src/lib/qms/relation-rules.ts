import { QmsRecordType } from "@prisma/client";

export type OperationalRelationRecord = {
  id: string;
  recordType: QmsRecordType;
  businessCode: string | null;
};

export type CanonicalOperationalRelation = {
  sourceRecordId: string;
  targetRecordId: string;
  relationType: "GENERATES";
  sourceType: QmsRecordType;
  targetType: QmsRecordType;
};

const allowedTargets: Partial<Record<QmsRecordType, QmsRecordType[]>> = {
  [QmsRecordType.DEVIATION]: [QmsRecordType.CAPA],
  [QmsRecordType.COMPLAINT]: [QmsRecordType.CAPA, QmsRecordType.RETURN],
  [QmsRecordType.CAPA]: [QmsRecordType.DEVIATION, QmsRecordType.COMPLAINT],
  [QmsRecordType.RETURN]: [QmsRecordType.COMPLAINT],
};

export function allowedOperationalRelationTypes(recordType: QmsRecordType) {
  return allowedTargets[recordType] ?? [];
}

export function canonicalOperationalRelation(
  current: OperationalRelationRecord,
  other: OperationalRelationRecord,
): CanonicalOperationalRelation {
  if (current.id === other.id) {
    throw new Error("Un expediente no puede relacionarse consigo mismo.");
  }

  const allowed = allowedOperationalRelationTypes(current.recordType);
  if (!allowed.includes(other.recordType)) {
    throw new Error(
      `Relación no permitida entre ${current.recordType} y ${other.recordType}.`,
    );
  }

  if (
    current.recordType === QmsRecordType.DEVIATION &&
    other.recordType === QmsRecordType.CAPA
  ) {
    return {
      sourceRecordId: current.id,
      targetRecordId: other.id,
      relationType: "GENERATES",
      sourceType: current.recordType,
      targetType: other.recordType,
    };
  }

  if (
    current.recordType === QmsRecordType.COMPLAINT &&
    (other.recordType === QmsRecordType.CAPA ||
      other.recordType === QmsRecordType.RETURN)
  ) {
    return {
      sourceRecordId: current.id,
      targetRecordId: other.id,
      relationType: "GENERATES",
      sourceType: current.recordType,
      targetType: other.recordType,
    };
  }

  if (
    current.recordType === QmsRecordType.CAPA &&
    (other.recordType === QmsRecordType.DEVIATION ||
      other.recordType === QmsRecordType.COMPLAINT)
  ) {
    return {
      sourceRecordId: other.id,
      targetRecordId: current.id,
      relationType: "GENERATES",
      sourceType: other.recordType,
      targetType: current.recordType,
    };
  }

  if (
    current.recordType === QmsRecordType.RETURN &&
    other.recordType === QmsRecordType.COMPLAINT
  ) {
    return {
      sourceRecordId: other.id,
      targetRecordId: current.id,
      relationType: "GENERATES",
      sourceType: other.recordType,
      targetType: current.recordType,
    };
  }

  throw new Error("La relación indicada no forma parte del modelo QMS operativo.");
}

export function operationalRelationLabel(
  sourceType: QmsRecordType,
  targetType: QmsRecordType,
) {
  if (sourceType === QmsRecordType.DEVIATION && targetType === QmsRecordType.CAPA) {
    return "Desviación → CAPA";
  }
  if (sourceType === QmsRecordType.COMPLAINT && targetType === QmsRecordType.CAPA) {
    return "Reclamación → CAPA";
  }
  if (sourceType === QmsRecordType.COMPLAINT && targetType === QmsRecordType.RETURN) {
    return "Reclamación → Devolución";
  }
  return "Relación QMS";
}
