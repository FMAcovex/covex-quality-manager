/**
 * Reglas de estado vigentes comunes a varios módulos con expediente (contrato de
 * módulo, PR 5). Las acciones de servidor ya las aplicaban en línea; se trasladan
 * sin cambiar su resultado. El ciclo de vida que declara cada contrato se
 * comprueba contra estas funciones en `lifecycle.test.ts`.
 */

/**
 * Guardado de la ficha (Desviaciones, CAPA, Controles de cambios, Reclamaciones
 * y Devoluciones): un expediente que ya salió de Borrador no vuelve a él.
 * `current` es `null` en el alta.
 */
export function keepsOperationalStatus(current: string | null, requested: string) {
  return current === null || current === "DRAFT" || requested !== "DRAFT";
}

/** Seguimientos de CAPA y de Controles de cambios: solo sobre expedientes que ya salieron de Borrador. */
export function acceptsFollowup<S extends string>(current: S): current is Exclude<S, "DRAFT"> {
  return current !== "DRAFT";
}
