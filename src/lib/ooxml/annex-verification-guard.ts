import path from "node:path";

/**
 * D-128: la verificación crea datos de prueba e instala plantillas, así que solo se ejecuta en una base de
 * datos desechable cuyo nombre empieza por «covex_annexes_verify». No hay ninguna otra excepción.
 */
export function assertDisposableDatabase(env: Record<string, string | undefined> = process.env) {
  let name = "";
  try { name = new URL(env.DATABASE_URL ?? "").pathname.slice(1); } catch { /* URL no válida: no es desechable. */ }
  if (!name.startsWith("covex_annexes_verify")) {
    throw new Error(`La verificación crea datos de prueba: usa una base de datos desechable cuyo nombre empiece por «covex_annexes_verify» (ahora: «${name || "sin DATABASE_URL"}»).`);
  }
}

/** La salida guarda copias de las plantillas oficiales: dentro del repositorio, solo en informe-anexos/ (ignorada por Git). */
export function assertOutputOutsideRepository(out: string, repositoryRoot: string) {
  const relative = path.relative(repositoryRoot, path.resolve(out));
  const inside = !relative.startsWith("..") && !path.isAbsolute(relative);
  if (inside && relative.split(path.sep)[0] !== "informe-anexos") {
    throw new Error("La salida contiene copias de las plantillas oficiales: dentro del repositorio solo puede ir en informe-anexos/ (no se versiona).");
  }
}
