import { documentPrincipal, type DocumentPrincipal } from "../documents/access";
export const lifecyclePermissions = ["verify", "record-approval", "accept-approval", "activate", "retire", "correct", "legacy-register"] as const;
export type LifecyclePermission = typeof lifecyclePermissions[number];
export type LifecyclePrincipal = DocumentPrincipal & { capabilities: string[] };
export function lifecyclePrincipal(headers: Pick<Headers, "get">, env: Record<string, string | undefined> = process.env): LifecyclePrincipal {
  const base = documentPrincipal(headers, env);
  const permissions = base.source === "TEST_DEMO"
    ? env.APP_ENV === "test" ? env.PNT_LIFECYCLE_TEST_PERMISSIONS || "" : ""
    : headers.get("x-pnt-permissions") || "";
  return { ...base, capabilities: permissions.split(",").map(v => v.trim()).filter(v => lifecyclePermissions.includes(v as LifecyclePermission)) };
}
export function requireLifecyclePermission(principal: LifecyclePrincipal, permission: LifecyclePermission) {
  if (!principal.name || !principal.capabilities.includes(permission)) throw new Error(`Operación no autorizada: ${permission}.`);
}
