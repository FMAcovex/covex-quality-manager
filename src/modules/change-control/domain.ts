export function changeClassificationLabel(value: string | null | undefined) {
  return value === "MAJOR" ? "Mayor" : value === "MINOR" ? "Menor" : "Pendiente";
}

export function changeRequestStatusLabel(value: string) {
  if (value === "ACCEPTED") return "Aceptada";
  if (value === "DENIED") return "Denegada";
  return "Pendiente";
}

export function changeDecisionLabel(value: string) {
  if (value === "APPROVED") return "Aprobado";
  if (value === "REJECTED") return "Rechazado";
  return "Pendiente";
}

export function changeExecutionLabel(value: string) {
  return value === "EXECUTED" ? "Ejecutado" : "No ejecutado";
}

export function changeEffectivenessLabel(value: string) {
  if (value === "ACCEPTABLE") return "Aceptable";
  if (value === "NOT_ACCEPTABLE") return "No aceptable";
  return "Pendiente";
}

export function changeStatusLabel(value: string) {
  if (value === "CLOSED") return "Cerrado";
  if (value === "REJECTED") return "Rechazado";
  if (value === "CANCELLED") return "Cancelado";
  return "Abierto";
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function scopeLabel(value: string) {
  return ({
    FACILITIES: "Instalaciones",
    EQUIPMENT: "Equipos",
    PROCESS: "Proceso",
    MATERIAL: "Material/MP",
    SUPPLIER: "Proveedor",
    DOCUMENTATION: "Documentación",
    OTHER: "Otros",
  } as Record<string,string>)[value] ?? value;
}
