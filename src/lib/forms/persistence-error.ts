import { Prisma } from "@prisma/client";

export type PersistenceFormError = {
  error: string;
  fieldErrors?: string[];
};

export function persistenceFormError(
  error: unknown,
  entityLabel: string,
): PersistenceFormError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        error: `No se puede guardar ${entityLabel}.`,
        fieldErrors: ["La codificación ya está utilizada por otro expediente del mismo tipo."],
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
