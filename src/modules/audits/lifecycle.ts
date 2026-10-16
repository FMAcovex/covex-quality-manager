/**
 * Reglas de estado vigentes de Auditorías (contrato de módulo, PR 5). Se
 * trasladan desde `saveAudit` y `closeAudit` sin cambiar su resultado ni el
 * orden en que `saveAudit` las comprueba.
 */

/**
 * Cierre en el guardado de la ficha: solo se cierra con Informe y cierre y una
 * auditoría cerrada no se reabre. Devuelve el motivo de rechazo o `null`.
 * `current` es `null` en el alta.
 */
export function auditClosureStatusError(current: string | null, requested: string): string | null {
  if (current === null && requested === "CLOSED") return "El cierre inicial requiere el procedimiento de Informe y cierre.";
  if (current !== "CLOSED" && requested === "CLOSED") return "Confirma el cierre mediante Informe y cierre.";
  if (current === "CLOSED" && requested !== "CLOSED") return "La auditoría cerrada no se reabre automáticamente. Conserva el estado Cerrada durante la edición.";
  return null;
}

export const auditDraftReturnMessage = "Una auditoría operativa no puede volver a Borrador.";

/** Una auditoría operativa no vuelve a Borrador. `saveAudit` lo comprueba después de la concurrencia del formulario. */
export function auditReturnsToDraft(current: string | null, requested: string) {
  return current !== null && current !== "DRAFT" && requested === "DRAFT";
}

/** Todas las reglas de estado del guardado de la ficha, en su orden; `null` si el cambio se admite. */
export function auditStatusChangeError(current: string | null, requested: string): string | null {
  return auditClosureStatusError(current, requested)
    ?? (auditReturnsToDraft(current, requested) ? auditDraftReturnMessage : null);
}

/** Informe y cierre (`closeAudit`): una auditoría cerrada no se vuelve a cerrar. Borrador lo bloquea `auditClosureChecklist`. */
export function auditAlreadyClosed(current: string) {
  return current === "CLOSED";
}
