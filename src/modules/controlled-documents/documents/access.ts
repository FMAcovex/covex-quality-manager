import { timingSafeEqual } from "node:crypto";
import { currentIdentity } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";

export type DocumentPrincipal = { name: string; source: "CORPORATE_SESSION" | "TRUSTED_PROXY" | "TEST_DEMO"; canWrite: boolean };
export function documentPrincipal(headers: Pick<Headers, "get">, env: Record<string, string | undefined> = process.env): DocumentPrincipal {
  const context = currentIdentity();
  if (context && !context.unitTest) {
    assertPermission(context.principal, "PNT", "READ");
    let canWrite = false;
    try { assertPermission(context.principal, "PNT", "ATTACH_DOCUMENT", context.resource); canWrite = true; } catch { /* Ordinary global consultation grants no documentary write. */ }
    return { name: context.principal.name, source: "CORPORATE_SESSION", canWrite };
  }
  // Legacy proxy fixtures are retained only in explicit automated unit tests.
  if (process.env.VITEST !== "true" || (env.APP_ENV && !["test", "demo"].includes(env.APP_ENV))) throw new Error("Acceso documental no autorizado.");
  if (env.PNT_DOCUMENT_ACCESS_MODE === "demo" && ["test", "demo"].includes(env.APP_ENV || ""))
    return { name: "Usuario de prueba documental", source: "TEST_DEMO", canWrite: true };
  const secret = env.PNT_DOCUMENT_PROXY_SECRET || "", supplied = headers.get("x-pnt-proxy-secret") || "";
  const name = headers.get("x-pnt-user")?.trim() || "";
  const permissions = (headers.get("x-pnt-permissions") || "").split(",").map(p => p.trim());
  if (env.PNT_DOCUMENT_ACCESS_MODE !== "trusted-proxy" || secret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied)) || !name || name.length > 200 || /[\r\n\x00]/.test(name) || !permissions.includes("read"))
    throw new Error("Acceso documental no autorizado o sin configurar.");
  return { name, source: "TRUSTED_PROXY", canWrite: permissions.includes("write") };
}
export function requireDocumentWrite(principal: DocumentPrincipal) {
  if (!principal.canWrite) throw new Error("No tiene permiso para incorporar documentos.");
}
