import { AccessError, accessModules, permissions, type AccessModule, type AccessPermission, type Principal } from "./context";

export type ResourceScope = { id?: string; departmentIds?: string[] };
export function assertPermission(user: Principal, module: AccessModule, permission: AccessPermission, resource: ResourceScope = {}) {
  if (!accessModules.includes(module) || !permissions.includes(permission)) throw new AccessError(403);
  if (!user.active || !user.authorized) throw new AccessError(403, "Usuario sin autorización activa.");
  // Approved policy: global ordinary read, regardless of department or role.
  if (permission === "READ" && module !== "SYSTEM") return;
  const grants = user.grants.filter(g => g.module === module && g.permission === permission);
  if (grants.some(g => g.scope === "ALL")) return;
  const assigned = grants.some(g => g.scope === "ASSIGNED");
  if (assigned && !["EXPORT", "IMPORT", "MANAGE_USERS", "MANAGE_CONFIGURATION"].includes(permission) &&
    ((resource.id && user.assignments.some(a => a.module === module && a.recordId === resource.id)) ||
      (resource.departmentIds?.length && resource.departmentIds.every(id => user.departmentIds.includes(id))))) return;
  throw new AccessError(403);
}
