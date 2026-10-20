/**
 * BE1-C (D-114): la aplicación hace consultas cortas, donde la compilación JIT de PostgreSQL cuesta más que la
 * propia consulta. Se desactiva en la conexión de la aplicación salvo que IT ya haya fijado `options`.
 */
export function withJitDisabled(url: string): string {
  let parsed: URL;
  try { parsed = new URL(url); } catch { /* URL no válida: Prisma informará al conectar. */ return url; }
  if (parsed.searchParams.has("options")) return url;
  parsed.searchParams.set("options", "-c jit=off");
  return parsed.toString();
}
