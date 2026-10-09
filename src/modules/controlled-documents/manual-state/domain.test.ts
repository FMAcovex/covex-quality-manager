import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { manualStatusSchema, validateManualChange } from "./domain";
import { lifecyclePrincipal, requireLifecyclePermission } from "../lifecycle/access";
const base = { requestId: randomUUID(), expectedVersion: 0, expectedUpdatedAt: "2026-10-09T12:00:00.000Z", targetStatus: "IN_FORCE" as const, reason: "Consta aprobación firmada en PDF externo", effectiveFrom: "2026-10-01", reviewDueAt: "2031-09-30", previousRevisionId: null };
describe("P3C-2 estados manuales y permisos", () => {
  it("exige motivo, UUID válido y versión optimista", () => {
    expect(manualStatusSchema.safeParse(base).success).toBe(true);
    expect(manualStatusSchema.safeParse({ ...base, reason: "" }).success).toBe(false);
    expect(manualStatusSchema.safeParse({ ...base, requestId: "fake" }).success).toBe(false);
    expect(manualStatusSchema.safeParse({ ...base, expectedVersion: -1 }).success).toBe(false);
    expect(manualStatusSchema.safeParse({ ...base, actor: "Suplantado" }).success).toBe(false);
    expect(manualStatusSchema.safeParse({ ...base, effectiveFrom: "2026-02-31" }).success).toBe(false);
  });
  it("la vigencia requiere fecha real y no futura", () => {
    expect(() => validateManualChange("DRAFT", base, "2026-10-09")).not.toThrow();
    expect(() => validateManualChange("DRAFT", { ...base, effectiveFrom: undefined }, "2026-10-09")).toThrow(/fecha real/);
    expect(() => validateManualChange("DRAFT", { ...base, effectiveFrom: "2026-11-01" }, "2026-10-09")).toThrow(/futura/);
    expect(() => validateManualChange("DRAFT", { ...base, reviewDueAt: "2026-09-01" }, "2026-10-09")).toThrow(/anterior/);
  });
  it("no reactiva obsoletos ni permite devolver una vigente a borrador", () => {
    expect(() => validateManualChange("OBSOLETE", { ...base, targetStatus: "IN_FORCE" }, "2026-10-09")).toThrow(/históricas/);
    expect(() => validateManualChange("ANNULLED", { ...base, targetStatus: "IN_REVIEW" }, "2026-10-09")).toThrow(/históricas/);
    expect(() => validateManualChange("IN_FORCE", { ...base, targetStatus: "DRAFT" }, "2026-10-09")).toThrow(/solo puede/);
    expect(() => validateManualChange("IN_FORCE", { ...base, targetStatus: "OBSOLETE" }, "2026-10-09")).not.toThrow();
  });
  it("lectura/escritura y otros permisos no otorgan gestión manual", () => {
    const env = { PNT_DOCUMENT_ACCESS_MODE: "trusted-proxy", PNT_DOCUMENT_PROXY_SECRET: "synthetic-test-key-not-a-real-secret" };
    const h = new Headers({ "x-pnt-proxy-secret": env.PNT_DOCUMENT_PROXY_SECRET, "x-pnt-user": "QA autenticado", "x-pnt-permissions": "read,write,verify,activate" });
    expect(() => requireLifecyclePermission(lifecyclePrincipal(h, env), "manage-state")).toThrow();
    h.set("x-pnt-permissions", "read,manage-state");
    expect(() => requireLifecyclePermission(lifecyclePrincipal(h, env), "manage-state")).not.toThrow();
  });
});
