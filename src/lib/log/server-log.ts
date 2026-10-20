import { randomBytes } from "node:crypto";
import { currentIdentity } from "@/lib/auth/context";

/**
 * Registro operativo de errores del servidor (BE1-B, D-113). Una línea JSON en la salida estándar con
 * metadatos técnicos fijos y la referencia que ve el usuario. Nunca escribe el mensaje del error, su `cause`,
 * el `meta` de Prisma, argumentos, cuerpos, cabeceras ni datos de la persona: no es el audit trail.
 * Escribe con `process.stdout.write` porque el arranque de producción silencia `console` (4B2).
 */
export type ServerErrorContext = { ref?: string; operation?: string; module?: string; userId?: string | null };

export function newErrorReference(): string {
  return "E-" + randomBytes(4).toString("hex");
}

function errorName(error: unknown): string {
  if (error === null) return "null";
  if (typeof error !== "object") return typeof error;
  // En producción las clases propias se minimizan: `name` conserva «SavedViewError»; solo si parece un identificador.
  const name = (error as { name?: unknown }).name;
  if (typeof name === "string" && /^[A-Za-z][\w.]{0,63}$/.test(name)) return name;
  return (error as { constructor?: { name?: string } }).constructor?.name || "Object";
}

// Una línea de pila de V8: «at fn (ruta:l:c)», «at fn (<anonymous>)» o «at ruta:l:c». Nada de texto libre.
const frameShape = /^at (?:.+ \((?:.+:\d+:\d+|<anonymous>|native|index \d+)\)|(?:\/|node:|file:|webpack).*:\d+:\d+)$/;

function stackFrames(error: unknown): string[] {
  if (!(error instanceof Error) || typeof error.stack !== "string") return [];
  // La cabecera de la pila repite el mensaje, que puede ocupar varias líneas: se descartan todas.
  const header = String(error.message ?? "").split("\n").length;
  return error.stack.split("\n").slice(header).map(line => line.trim()).filter(line => frameShape.test(line)).slice(0, 10);
}

export function serverErrorLine(event: string, error: unknown, context: ServerErrorContext & { ref: string; at: Date }): string {
  const prisma = error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" && /^P\d{4}$/.test((error as { code: string }).code)
    ? error as { code: string; meta?: { modelName?: unknown } } : null;
  return JSON.stringify({
    service: "covex-quality-manager", event, level: "error", at: context.at.toISOString(), ref: context.ref,
    operation: context.operation ?? null, module: context.module ?? null, userId: context.userId ?? null,
    errorName: errorName(error),
    ...(prisma ? { prismaCode: prisma.code, prismaModel: typeof prisma.meta?.modelName === "string" ? prisma.meta.modelName : null } : {}),
    frames: stackFrames(error),
  });
}

/** Registra el error y devuelve la referencia (la recibida o una `E-…` nueva). Nunca lanza. */
export function logServerError(event: string, error: unknown, context: ServerErrorContext = {}, write: (line: string) => void = line => process.stdout.write(line + "\n")): string {
  const ref = context.ref || newErrorReference();
  const at = new Date();
  try {
    let userId = context.userId;
    if (userId === undefined) { try { userId = currentIdentity()?.principal.id ?? null; } catch { userId = null; /* Sin contexto de identidad (arranque, scripts). */ } }
    write(serverErrorLine(event, error, { ...context, ref, at, userId }));
  } catch {
    try { write(JSON.stringify({ service: "covex-quality-manager", event, level: "error", at: at.toISOString(), ref })); } catch { /* Sin salida disponible: no se interrumpe la respuesta. */ }
  }
  return ref;
}
