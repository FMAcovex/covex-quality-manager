/**
 * RET1: código de una acción derivada al guardar la reclamación. El de una devolución propuesta lo pone la
 * devolución al abrirse (el campo es de solo lectura): un formulario abierto antes no lo borra.
 */
export function derivedActionBusinessCode(stored: string | null | undefined, submitted: string | null | undefined) {
  return stored || submitted || null;
}
