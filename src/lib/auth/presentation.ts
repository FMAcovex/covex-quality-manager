import { permissions, accessModules, AccessError, currentIdentity, type AccessModule, type AccessPermission, type Principal } from "./context";
import { assertPermission, type ResourceScope } from "./policy";

export type CapabilitySet = Record<AccessPermission, boolean>;
export type PresentationAccess = {
  actor: string;
  module: AccessModule;
  current: CapabilitySet;
  modules: Record<AccessModule, CapabilitySet>;
  related: Record<string, boolean>;
  departments: Record<string, boolean>;
  editForm: boolean;
  plans: Record<string, boolean>;
};

// Presentation uses the same policy as server operations; it never grants access.
export function canPresent(user: Principal, module: AccessModule, permission: AccessPermission, scope: ResourceScope = {}) {
  try { assertPermission(user, module, permission, scope); return true; }
  catch (error) { if (error instanceof AccessError) return false; throw error; }
}
export function currentActor() { return currentIdentity()?.principal.name ?? ""; }
export function canPresentRecord(module: AccessModule, permission: AccessPermission, scope: ResourceScope) {
  const user = currentIdentity()?.principal;
  return Boolean(user && canPresent(user, module, permission, scope));
}
export function capabilities(user: Principal, module: AccessModule, scope: ResourceScope = {}): CapabilitySet {
  return Object.fromEntries(permissions.map(permission => [permission, canPresent(user, module, permission, scope)])) as CapabilitySet;
}
export function presentationAccess(user: Principal, module: AccessModule, scope: ResourceScope = {}): PresentationAccess {
  const modules = Object.fromEntries(accessModules.map(m => {
    const value = capabilities(user, m);
    // Scoped creation is possible in an authorized department; the form filters choices.
    value.CREATE ||= user.departmentIds.some(id => canPresent(user, m, "CREATE", { departmentIds: [id] }));
    return [m, value];
  })) as PresentationAccess["modules"];
  return { actor: user.name, module, current: capabilities(user, module, scope), modules, related: {}, departments: {}, plans: {}, editForm: canPresent(user, module, "EDIT", scope) };
}
