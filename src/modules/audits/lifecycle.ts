/**
 * Reglas de estado vigentes de Auditorías (contrato de módulo, PR 5). Se
 * trasladan desde `saveAudit` y `closeAudit` sin cambiar su resultado.
 */

/**
 * Guardado de la ficha (`saveAudit`): devuelve el motivo de rechazo o `null`.
 * El cierre solo se hace con Informe y cierre, una auditoría cerrada no se
 * reabre y una auditoría operativa no vuelve a Borrador. `current` es `null`
 * en el alta.
 */
export function auditStatusChangeError(current: string | null, requested: string): string | null {
  if (current === null && requested === "CLOSED") return "El cierre inicial requiere el procedimiento de Informe y cierre.";
  if (current !== "CLOSED" && requested === "CLOSED") return "Confirma el cierre mediante Informe y cierre.";
  if (current === "CLOSED" && requested !== "CLOSED") return "La auditoría cerrada no se reabre automáticamente. Conserva el estado Cerrada durante la edición.";
  if (current !== null && current !== "DRAFT" && requested === "DRAFT") return "Una auditoría operativa no puede volver a Borrador.";
  return null;
}

/** Informe y cierre (`closeAudit`): una auditoría cerrada no se vuelve a cerrar. Borrador lo bloquea `auditClosureChecklist`. */
export function auditAlreadyClosed(current: string) {
  return current === "CLOSED";
}
