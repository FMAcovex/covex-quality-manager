// Client components are also rendered on the server: keep the date identical
// across server/browser time zones, including the UTC/Madrid midnight boundary.
export function formatAdministrativeDate(value: string): string {
  return new Date(value).toLocaleDateString("es-ES", { timeZone: "UTC" });
}
