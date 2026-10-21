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

const zone = "Europe/Madrid";
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short",
});

function madridParts(value: Date) {
  return Object.fromEntries(parts.formatToParts(value).map((part) => [part.type, part.value])) as Record<string, string>;
}

/** Desfase de Madrid respecto a UTC, en minutos, en un instante dado. */
function madridOffsetMinutes(value: Date) {
  const p = madridParts(value);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - Math.floor(value.getTime() / 1000) * 1000) / 60000);
}

/**
 * Inicio (o fin, con `end`) de un día natural de Madrid, en UTC (D-117): los filtros de fecha del
 * audit trail se refieren al día de la planta. Los cambios de hora no ocurren a medianoche.
 */
export function madridDayBoundary(day: string, end = false): Date {
  const [year, month, date] = day.split("-").map(Number);
  const start = (y: number, m: number, d: number) => {
    const guess = Date.UTC(y, m - 1, d);
    return new Date(guess - madridOffsetMinutes(new Date(guess)) * 60000);
  };
  return end ? new Date(start(year, month, date + 1).getTime() - 1) : start(year, month, date);
}

/** Fecha y hora de Madrid ordenable para la exportación CSV («2026-10-08 00:11:05 CEST»). */
export function formatAuditTrailCsvLocal(value: Date): string {
  const p = madridParts(value);
  const zoneName = formatter.formatToParts(value).find((part) => part.type === "timeZoneName")?.value ?? p.timeZoneName;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} ${zoneName}`;
}
