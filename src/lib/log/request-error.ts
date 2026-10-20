import { logServerError } from "@/lib/log/server-log";

/**
 * Errores no controlados que Next.js entrega a `onRequestError` (BE1-B). La referencia es el `digest` que la
 * página de error muestra como «Referencia técnica». Solo se registra la plantilla de ruta, nunca la URL real
 * ni su consulta.
 */
export function handleRequestError(error: unknown, request: { path: string; method: string }, context: { routePath: string; routeType: string }, write?: (line: string) => void): string {
  const digest = error && typeof error === "object" && typeof (error as { digest?: unknown }).digest === "string" ? (error as { digest: string }).digest : undefined;
  return logServerError("request.unhandled", error, { ref: digest, operation: `${request.method} ${context.routePath}`, module: context.routeType }, write);
}
