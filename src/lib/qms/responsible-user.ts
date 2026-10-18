import { z } from "zod";

/**
 * Usuario de la aplicación junto a un responsable en texto libre (D-101). El texto se conserva y
 * es lo que se imprime en los anexos; el usuario es opcional y sirve para «Asignadas a mí».
 */
export type AppUserOption = { id: string; name: string; active: boolean };

/** Valor de formulario: un UUID o vacío (sin usuario). */
export const responsibleUserIdSchema = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.string().uuid("Usuario de la aplicación no válido.").nullable());

export function optionalUserId(value: unknown) {
  const parsed = responsibleUserIdSchema.safeParse(typeof value === "string" ? value : "");
  return parsed.success ? parsed.data : undefined;
}

/** Texto que se propone al elegir un usuario: su nombre, solo si el responsable está vacío. */
export function responsibleTextAfterPick(currentText: string, user: AppUserOption | undefined) {
  return currentText.trim() || !user ? currentText : user.name;
}

/**
 * Campo de usuario dentro de una fila JSON: un valor no válido se trata como «sin usuario» para no
 * descartar la fila entera. Que el usuario esté activo se comprueba al guardar.
 */
export const rowUserIdSchema = z.string().nullable().optional().catch(null).transform((value) => optionalUserId(value) ?? null);

/** Selección del usuario vinculado para mostrarlo en la ficha. */
export const responsibleUserSelect = { select: { displayName: true } } as const;
