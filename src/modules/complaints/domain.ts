export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
export function complaintTypeLabel(value: string) {
  return value === "PROVIDER" ? "A proveedor" : "De cliente";
}
export function complaintClassificationLabel(value: string | null | undefined) {
  if (value === "CRITICAL") return "Crítica";
  if (value === "MAJOR") return "Mayor";
  if (value === "MINOR") return "Menor";
  if (value === "NO_GMP_IMPACT") return "Sin impacto GMP";
  return "Sin clasificar";
}
export function complaintStatusLabel(value: string) {
  return value === "CLOSED" ? "Cerrada" : "Abierta";
}
export function complaintEffectivenessLabel(value: string) {
  if (value === "ACCEPTABLE") return "Aceptable";
  if (value === "NOT_ACCEPTABLE") return "No aceptable";
  if (value === "NOT_REQUIRED") return "No requerida";
  return "Pendiente";
}
export function investigationResultLabel(value: string | null | undefined) {
  if (value === "PROCEDENT") return "Procedente";
  if (value === "NOT_PROCEDENT") return "No procedente";
  if (value === "INCONCLUSIVE") return "No concluyente";
  if (value === "NOT_ATTRIBUTABLE_TO_COVEX") return "No atribuible a COVEX";
  return "Pendiente";
}
