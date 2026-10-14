import { Prisma } from "@prisma/client";

export type PersistenceFormError = {
  error: string;
  fieldErrors?: string[];
  fieldIssues?: Record<string, string[]>;
};

export function requiresAuditReason(error: unknown): boolean {
  const pattern = /Reason required for (established critical correction|critical operational decision|official version activation\/retirement)/;
  let current = error;
  for (let depth=0; depth<4 && current && typeof current==="object"; depth++) {
    if ("message" in current && typeof current.message==="string" && pattern.test(current.message)) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export function persistenceFormError(
  error: unknown,
  entityLabel: string,
  options: { duplicateField?: string } = {},
): PersistenceFormError {
  if (requiresAuditReason(error)) {
    const message = "Indica el motivo de esta modificación crítica antes de guardar.";
    return { error: message, fieldErrors: [message], fieldIssues: { changeReason: [message] } };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const message = "La codificación ya está utilizada por otro expediente del mismo tipo.";
      return {
        error: `No se puede guardar ${entityLabel}.`,
        fieldErrors: [message],
        fieldIssues: options.duplicateField
          ? { [options.duplicateField]: [message] }
          : undefined,
      };
    }
    if (error.code === "P2003") {
      return {
        error: `No se puede guardar ${entityLabel}.`,
        fieldErrors: ["Uno de los valores seleccionados ya no existe o no está disponible. Recarga el formulario y vuelve a seleccionarlo."],
      };
    }
    if (error.code === "P2025") {
      return {
        error: `No se puede guardar ${entityLabel}.`,
        fieldErrors: ["El expediente o uno de los registros relacionados ya no existe. Recarga la página."],
      };
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      error: `No se puede guardar ${entityLabel}.`,
      fieldErrors: ["Hay un dato con formato no válido. Revisa fechas, selecciones y campos obligatorios."],
    };
  }

  return {
    error: `No se ha podido guardar ${entityLabel}.`,
    fieldErrors: [
      "Se ha producido un error inesperado de persistencia. Los datos no se han guardado. Revisa los campos e inténtalo de nuevo.",
    ],
  };
}
