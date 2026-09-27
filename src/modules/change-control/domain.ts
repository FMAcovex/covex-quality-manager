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
  return value === "CLOSED" ? "Cerrado" : "Abierto";
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
