/**
 * Fecha y hora de las operaciones del audit trail en hora local de la planta (D-117, H-14).
 * Zona fija para que el servidor y el navegador muestren el mismo texto; los datos se conservan en UTC.
 */
const formatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid", day: "numeric", month: "short", year: "numeric",
  hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short",
});

export function formatAuditTrailDateTime(value: Date): string {
  return formatter.format(value);
}
