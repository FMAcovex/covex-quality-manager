export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function classificationLabel(value: string | null | undefined) {
  if (value === "MAJOR") return "Mayor";
  if (value === "MINOR") return "Menor";
  return "Pendiente";
}

export function requestDecisionLabel(value: string) {
  if (value === "ACCEPTED") return "Aceptada";
  if (value === "DENIED") return "Denegada";
  return "Pendiente";
}

export function dictamenResultLabel(value: string) {
  if (value === "APPROVED") return "Aprobado";
  if (value === "REJECTED") return "Rechazado";
  return "Pendiente";
}

export function executionStatusLabel(value: string) {
  return value === "EXECUTED" ? "Ejecutado" : "No ejecutado";
}

export function effectivenessStatusLabel(value: string) {
  if (value === "ACCEPTABLE") return "Aceptable";
  if (value === "NOT_ACCEPTABLE") return "No aceptable";
  if (value === "NOT_APPLICABLE") return "No aplica";
  return "Pendiente";
}

export function finalStatusLabel(value: string) {
  if (value === "DRAFT") return "Borrador";
  return value === "CLOSED" ? "Cerrado" : "Abierto";
}

export type ChangeControlFunctionalState = {
  finalStatus: string;
  requestDecision: string;
  dictamenResult: string;
  executionStatus: string;
  effectivenessStatus: string;
};

export function functionalStatusLabel(record: ChangeControlFunctionalState) {
  if (record.finalStatus === "DRAFT") return "Borrador";
  if (record.finalStatus === "CLOSED") return "Cerrado";
  if (record.requestDecision === "PENDING") return "Solicitud pendiente";
  if (record.requestDecision === "DENIED") return "Solicitud denegada";
  if (record.dictamenResult === "PENDING") return "Solicitud aceptada · Dictamen pendiente";
  if (record.dictamenResult === "REJECTED") return "Dictamen rechazado";
  if (record.executionStatus !== "EXECUTED") return "Dictamen aprobado · Ejecución pendiente";
  if (record.effectivenessStatus === "PENDING") return "Ejecutado · Eficacia pendiente";
  if (record.effectivenessStatus === "ACCEPTABLE") return "Ejecutado · Eficacia aceptable";
  if (record.effectivenessStatus === "NOT_ACCEPTABLE") return "Ejecutado · Eficacia no aceptable";
  return "Ejecutado · Eficacia no aplica";
}

export function functionalStatusTone(record: ChangeControlFunctionalState) {
  if (record.finalStatus === "DRAFT") return "neutral";
  if (record.finalStatus === "CLOSED") return "closed";
  if (record.requestDecision === "DENIED" || record.dictamenResult === "REJECTED" || record.effectivenessStatus === "NOT_ACCEPTABLE") return "major";
  if (record.effectivenessStatus === "ACCEPTABLE") return "closed";
  if (record.effectivenessStatus === "NOT_APPLICABLE") return "neutral";
  return "warning";
}

export function nextFollowupDateFromHistory<T extends {
  sequenceNumber: number;
  nextFollowupDate: Date | string | null;
}>(followups: T[]) {
  if (!followups.length) return null;
  return followups.reduce((latest, item) =>
    item.sequenceNumber > latest.sequenceNumber ? item : latest,
  ).nextFollowupDate;
}

export const scopeLabels: Record<string, string> = {
  INSTALLATIONS: "Instalaciones",
  EQUIPMENT: "Equipos",
  PROCESS: "Proceso",
  MATERIAL: "Material/MP",
  SUPPLIER: "Proveedor",
  DOCUMENTATION: "Documentación",
  OTHER: "Otros",
};
