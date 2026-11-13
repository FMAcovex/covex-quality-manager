// Client components are also rendered on the server: keep the date identical
// across server/browser time zones, including the UTC/Madrid midnight boundary.
export function formatAdministrativeDate(value: string): string {
  return new Date(value).toLocaleDateString("es-ES", { timeZone: "UTC" });
}

// FEC1: las fechas administrativas (apertura, comunicación, vigencia…) son días naturales de la planta.
// «Hoy» se toma del calendario de Madrid, sea cual sea la zona horaria del servidor o del navegador.
const plantDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });

/** Día de hoy en Madrid, «AAAA-MM-DD». */
export function administrativeToday(now: Date = new Date()): string {
  return plantDay.format(now);
}

/** Día de hoy en Madrid guardado como las fechas administrativas: medianoche UTC de ese día. */
export function administrativeTodayDate(now: Date = new Date()): Date {
  return new Date(`${administrativeToday(now)}T00:00:00.000Z`);
}
