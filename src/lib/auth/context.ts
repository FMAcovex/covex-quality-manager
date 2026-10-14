import { AsyncLocalStorage } from "node:async_hooks";

export const accessModules = ["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT", "PNT", "SYSTEM"] as const;
export type AccessModule = typeof accessModules[number];
export const permissions = ["READ", "CREATE", "EDIT", "FOLLOWUP", "REVIEW", "CLOSE", "ANNUL", "DOWNLOAD", "EXPORT", "IMPORT", "MANAGE_CONFIGURATION", "MANAGE_USERS", "ATTACH_DOCUMENT", "GENERATE_DOCUMENT", "AUDIT_ISSUE_REPORT", "AUDIT_ISSUE_PROGRAMME", "PNT_VERIFY", "PNT_RECORD_APPROVAL", "PNT_ACCEPT_APPROVAL", "PNT_ACTIVATE", "PNT_RETIRE", "PNT_CORRECT", "PNT_LEGACY_REGISTER", "PNT_MANAGE_STATE", "AUDIT_TRAIL_REVIEW", "AUDIT_TRAIL_EXPORT", "AUDIT_TRAIL_SENSITIVE_READ"] as const;
export type AccessPermission = typeof permissions[number];
export type Grant = { module: AccessModule; permission: AccessPermission; scope: "ALL" | "ASSIGNED" };
export type Principal = { id: string; tenantId: string; objectId: string; name: string; email: string; roles: string[]; grants: Grant[]; departmentIds: string[]; assignments: { module: AccessModule; recordId: string }[]; active: boolean; authorized: boolean };
export type AuthorizationClaim = { module: AccessModule; permission: AccessPermission; resource: { id?: string; departmentIds?: string[] } };
export type IdentityContext = { principal: Principal; unitTest?: boolean; testHarness?: boolean; resource?: { id?: string; departmentIds?: string[] }; module?: AccessModule; createdRecords?: Set<string>; auditClaims?: AuthorizationClaim[] };
const key = Symbol.for("covex.identity.context");
const shared = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<IdentityContext> };
export const identityContext = shared[key] ??= new AsyncLocalStorage<IdentityContext>();
export const currentIdentity = () => identityContext.getStore();

export class AccessError extends Error {
  constructor(public status: 401 | 403, message = "No tiene autorización para esta operación.") { super(message); this.name = "AccessError"; }
}
