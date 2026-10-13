import { describe, it, expect } from "vitest";
import { accessModules, identityContext, type IdentityContext, type Principal, type AccessPermission } from "./context";
import { canPresent } from "./presentation";
import { assertPermission } from "./policy";
import { authConfiguration, isolatedTestEnvironment, safeReturnTo } from "./config";
const modules = accessModules.filter(m => m !== "SYSTEM");
const base: Principal = { id: "user", tenantId: "tenant", objectId: "oid", name: "Sintético", email: "test@example.invalid", active: true, authorized: true, roles: ["READER"], grants: [], departmentIds: ["own"], assignments: [] };
describe("4B1 consulta global y permisos separados en los siete módulos", () => {
  it("records executed authorization checks without turning capability probes into command requirements", () => {
    const user: Principal = { ...base, grants: [{ module: "PNT", permission: "EDIT", scope: "ALL" }, { module: "PNT", permission: "PNT_VERIFY", scope: "ALL" }] };
    const context: IdentityContext = { principal: user, auditClaims: [] };
    identityContext.run(context, () => {
      expect(canPresent(user, "PNT", "PNT_VERIFY")).toBe(true);
      expect(context.auditClaims).toEqual([]);
      assertPermission(user, "PNT", "EDIT", { id: "synthetic-document" });
      expect(context.auditClaims).toEqual([{ module: "PNT", permission: "EDIT", resource: { id: "synthetic-document" } }]);
    });
  });
  it.each(modules)("%s: consulta global, sin escritura/exportación/cierre implícitos", module => {
    expect(() => assertPermission(base, module, "READ", { id: "foreign", departmentIds: ["other"] })).not.toThrow();
    for (const permission of ["CREATE", "EDIT", "FOLLOWUP", "REVIEW", "CLOSE", "ANNUL", "DOWNLOAD", "EXPORT", "IMPORT", "MANAGE_CONFIGURATION"] as AccessPermission[]) expect(() => assertPermission(base, module, permission, { departmentIds: ["own"] })).toThrow();
  });
  it.each(modules)("%s: deniega desactivados y no admitidos, incluso READ", module => {
    expect(() => assertPermission({ ...base, active: false }, module, "READ")).toThrow();
    expect(() => assertPermission({ ...base, authorized: false }, module, "READ")).toThrow();
  });
  it.each(modules)("%s: escritura limitada al expediente o a todos los departamentos afectados", module => {
    const manager: Principal = { ...base, grants: [{ module, permission: "EDIT", scope: "ASSIGNED" }], assignments: [{ module, recordId: "assigned" }] };
    expect(() => assertPermission(manager, module, "EDIT", { id: "own-record", departmentIds: ["own"] })).not.toThrow();
    expect(() => assertPermission(manager, module, "EDIT", { id: "assigned", departmentIds: ["other"] })).not.toThrow();
    expect(() => assertPermission(manager, module, "EDIT", { id: "foreign", departmentIds: ["other"] })).toThrow();
    expect(() => assertPermission(manager, module, "EDIT", { id: "foreign", departmentIds: ["own", "other"] })).toThrow();
    expect(() => assertPermission(manager, module, "EDIT")).toThrow();
    expect(() => assertPermission(manager, module, "CLOSE", { id: "assigned" })).toThrow();
  });
  it.each(modules)("%s: IT no hereda permisos GMP; quitar una concesión deniega la siguiente operación", module => {
    const admin = { ...base, roles: ["TECHNICAL_ADMIN"], grants: [{ module: "SYSTEM" as const, permission: "MANAGE_USERS" as const, scope: "ALL" as const }] };
    expect(() => assertPermission(admin, "SYSTEM", "MANAGE_USERS")).not.toThrow();
    for (const permission of ["EDIT", "REVIEW", "CLOSE"] as AccessPermission[]) expect(() => assertPermission(admin, module, permission)).toThrow();
    const operator: Principal = { ...base, grants: [{ module, permission: "EDIT", scope: "ALL" }] };
    expect(() => assertPermission(operator, module, "EDIT")).not.toThrow(); operator.grants = [];
    expect(() => assertPermission(operator, module, "EDIT")).toThrow();
    expect(() => assertPermission(operator, module, "READ", { departmentIds: ["other"] })).not.toThrow();
  });
});
describe("4B1 configuración cerrada y aislamiento sintético", () => {
  const env = { APP_ENV: "test", AUTH_PROVIDER: "synthetic", AUTH_SYNTHETIC_IDENTITY: "1", DATABASE_URL: "postgresql://test:test@127.0.0.1:5458/covex_phase4b1_test_unit", AUTH_ORIGIN: "http://127.0.0.1:3000", AUTH_TEST_ISSUER: "http://127.0.0.1:5459", AUTH_ENTRA_TENANT_ID: "11111111-1111-4111-8111-111111111111", AUTH_ENTRA_CLIENT_ID: "22222222-2222-4222-8222-222222222222", AUTH_ENTRA_CLIENT_SECRET: "synthetic_unit_test_secret" };
  it("exige configuración completa y rechaza pruebas en producción/base habitual/remota", () => {
    expect(() => authConfiguration({ APP_ENV: "production" })).toThrow();
    expect(authConfiguration(env).synthetic).toBe(true);
    for (const change of [{ APP_ENV: "production" }, { DATABASE_URL: "postgresql://test:test@127.0.0.1/covex_quality" }, { DATABASE_URL: "postgresql://test:test@corporate.invalid/covex_phase4b1_test_unit" }, { AUTH_TEST_ISSUER: "https://external.invalid" }, { AUTH_ORIGIN: "http://external.invalid" }, { AUTH_ENTRA_CLIENT_SECRET: "" }]) expect(() => authConfiguration({ ...env, ...change })).toThrow();
    expect(isolatedTestEnvironment({ ...env, DATABASE_URL: "postgresql://test:test@127.0.0.1/covex_quality", CI: "true", GITHUB_ACTIONS: "true" })).toBe(true);
    expect(() => authConfiguration({ ...env, AUTH_PROVIDER: "entra" })).toThrow();
  });
  it("rechaza redirecciones externas", () => {
    for (const target of ["https://external.invalid", "//external.invalid", "/\\external.invalid", "/auth/login", "/\nexternal.invalid"]) expect(safeReturnTo(target)).toBe("/");
    expect(safeReturnTo("/capa?page=2")).toBe("/capa?page=2");
  });
});
