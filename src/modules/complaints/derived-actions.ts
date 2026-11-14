/**
 * RET1: código de una acción derivada al guardar la reclamación. El de una devolución propuesta lo pone la
 * devolución al abrirse (el campo es de solo lectura): un formulario abierto antes no lo borra ni lo cambia. En
 * los demás tipos, la referencia se puede corregir o vaciar.
 */
export function derivedActionBusinessCode(actionType: string, stored: string | null | undefined, submitted: string | null | undefined) {
  if (actionType === "RETURN") return stored || submitted || null;
  return submitted || null;
}

/** RET1: error de negocio al guardar la reclamación (se muestra tal cual en el formulario). */
export class DerivedActionReservedError extends Error {}

/**
 * RET1: una devolución propuesta reservada por un borrador de devolución en curso no se puede quitar ni cambiar
 * de tipo: el borrador no podría abrirse con ella. Devuelve el motivo o null.
 */
export function reservedProposalProblem(
  existing: Array<{ id: string; actionType: string }>,
  submitted: Array<{ id?: string | null; actionType?: string | null }>,
  reservedIds: Set<string>,
) {
  for (const row of existing) {
    if (!reservedIds.has(row.id)) continue;
    const kept = submitted.find((item) => item.id === row.id);
    if (!kept || (kept.actionType || "OTRA") !== "RETURN")
      return "Hay un borrador de devolución creado desde esta devolución propuesta: ábralo o anúlelo antes de quitar la propuesta o cambiar su tipo.";
  }
  return null;
}
