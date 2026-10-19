/**
 * Orígenes que muestra el formulario de una CAPA (R5B1): las relaciones activas y, en borrador,
 * también los orígenes pendientes guardados, sin duplicados. Así, vincular un borrador desde una
 * auditoría no oculta ni sustituye los orígenes que el borrador ya tenía.
 */
export function capaEditOrigins<T extends { id: string }>(relationOrigins: T[], pendingOrigins: T[]): T[] {
  const seen = new Set(relationOrigins.map((record) => record.id));
  return [...relationOrigins, ...pendingOrigins.filter((record) => !seen.has(record.id))];
}
