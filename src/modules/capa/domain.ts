export function capaTypeLabel(value: string) {
  return value === "PREVENTIVE" ? "Preventiva" : "Correctiva";
}

export function capaStatusLabel(value: string) {
  if (value === "CLOSED") return "Cerrada";
  if (value === "CANCELLED") return "Cancelada";
  return "Abierta";
}

export function effectivenessLabel(value: string) {
  if (value === "CONFORMING") return "Conforme";
  if (value === "NONCONFORMING") return "No conforme";
  return "Pendiente";
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
