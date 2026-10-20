import { documentPrincipal, type DocumentPrincipal } from "../documents/access";
import { currentIdentity, type AccessPermission } from "@/lib/auth/context";
import { assertPermission } from "@/lib/auth/policy";
export const lifecyclePermissions = ["verify", "record-approval", "accept-approval", "activate", "retire", "correct", "legacy-register", "manage-state"] as const;
export type LifecyclePermission = typeof lifecyclePermissions[number];
export type LifecyclePrincipal = DocumentPrincipal & { capabilities: string[] };
export function lifecyclePrincipal(headers: Pick<Headers, "get">, env: Record<string, string | undefined> = process.env): LifecyclePrincipal {
  const base = documentPrincipal(headers, env);
  if (base.source === "CORPORATE_SESSION") {
    const context = currentIdentity()!;
    const capabilities = lifecyclePermissions.filter(capability => {
      try { assertPermission(context.principal, "PNT", ("PNT_" + capability.replaceAll("-", "_").toUpperCase()) as AccessPermission, context.resource, false); return true; } catch { /* Sin permiso o acceso no configurado: se responde como acceso denegado. */ return false; }
    });
    return { ...base, capabilities };
  }
  const permissions = base.source === "TEST_DEMO"
    ? env.APP_ENV === "test" ? env.PNT_LIFECYCLE_TEST_PERMISSIONS || "" : ""
    : headers.get("x-pnt-permissions") || "";
  return { ...base, capabilities: permissions.split(",").map(v => v.trim()).filter(v => lifecyclePermissions.includes(v as LifecyclePermission)) };
}
export function requireLifecyclePermission(principal: LifecyclePrincipal, permission: LifecyclePermission) {
  if (!principal.name || !principal.capabilities.includes(permission)) throw new Error(`Operación no autorizada: ${permission}.`);
  const context = currentIdentity();
  if (principal.source === "CORPORATE_SESSION" && context && !context.unitTest) assertPermission(context.principal, "PNT", ("PNT_" + permission.replaceAll("-", "_").toUpperCase()) as AccessPermission, context.resource);
}
