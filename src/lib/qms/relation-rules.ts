import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { QmsRelationValidationError } from "@/lib/qms/relation-errors";
import { registeredRelationRules } from "@/modules/registry";

export { QmsRelationValidationError };

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

type AllowedRelation = Readonly<{
  sourceType: QmsRecordType;
  targetType: QmsRecordType;
  relationType: QmsRelationType;
  label: string;
}>;

// Única fuente de verdad: las relaciones declaradas por cada módulo en su
// contrato (src/modules/*/contract.ts), en el orden del registro.
export const allowedRelations: readonly AllowedRelation[] = registeredRelationRules.map((rule) => ({
  sourceType: rule.source,
  targetType: rule.target,
  relationType: rule.type,
  label: rule.label,
}));

export function canRelate(
  sourceType: QmsRecordType,
  targetType: QmsRecordType,
  relationType: QmsRelationType,
) {
  return allowedRelations.some(
    (rule) =>
      rule.sourceType === sourceType &&
      rule.targetType === targetType &&
      rule.relationType === relationType,
  );
}

export function allowedOutgoingRelationTypes(sourceType: QmsRecordType) {
  return allowedRelations
    .filter((rule) => rule.sourceType === sourceType)
    .map((rule) => rule.targetType);
}

export function allowedIncomingRelationTypes(targetType: QmsRecordType) {
  return allowedRelations
    .filter((rule) => rule.targetType === targetType)
    .map((rule) => rule.sourceType);
}

/** Tipos compatibles para formularios que se abren desde cualquiera de los extremos. */
export function allowedOperationalRelationTypes(recordType: QmsRecordType) {
  return [
    ...new Set([
      ...allowedOutgoingRelationTypes(recordType),
      ...allowedIncomingRelationTypes(recordType),
    ]),
  ];
}

export function validateQmsRelation(
  source: OperationalRelationRecord,
  target: OperationalRelationRecord,
  relationType: QmsRelationType = QmsRelationType.GENERATES,
): CanonicalOperationalRelation {
  if (!source.id || !target.id) {
    throw new QmsRelationValidationError(
      "Los dos expedientes QMS son obligatorios para crear la relación.",
    );
  }

  if (source.id === target.id) {
    throw new QmsRelationValidationError(
      "Un expediente no puede relacionarse consigo mismo.",
    );
  }

  if (!canRelate(source.recordType, target.recordType, relationType)) {
    throw new QmsRelationValidationError(
      `Relación no permitida: ${source.recordType} no puede ${relationType} ${target.recordType}.`,
    );
  }

  return {
    sourceRecordId: source.id,
    targetRecordId: target.id,
    relationType: QmsRelationType.GENERATES,
    sourceType: source.recordType,
    targetType: target.recordType,
  };
}

/**
 * Alias conservado para los consumidores existentes. La función es estrictamente
 * direccional: una consulta inversa no autoriza a crear una relación inversa.
 */
export function canonicalOperationalRelation(
  source: OperationalRelationRecord,
  target: OperationalRelationRecord,
): CanonicalOperationalRelation {
  return validateQmsRelation(source, target, QmsRelationType.GENERATES);
}

export function operationalRelationLabel(
  sourceType: QmsRecordType,
  targetType: QmsRecordType,
) {
  return (
    allowedRelations.find(
      (rule) =>
        rule.sourceType === sourceType &&
        rule.targetType === targetType &&
        rule.relationType === QmsRelationType.GENERATES,
    )?.label ?? "Relación QMS"
  );
}

export function selectOperationalRelationTarget(
  currentType: QmsRecordType,
  matches: OperationalRelationRecord[],
) {
  const allowed = new Set(allowedOperationalRelationTypes(currentType));
  const candidates = matches.filter((item) => allowed.has(item.recordType));

  if (candidates.length === 0) {
    throw new QmsRelationValidationError(
      "No existe un expediente compatible con esa codificación.",
    );
  }
  if (candidates.length > 1) {
    throw new QmsRelationValidationError(
      "La codificación coincide con más de un tipo de expediente compatible. Debe seleccionarse el tipo de destino.",
    );
  }
  return candidates[0];
}
