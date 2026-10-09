import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { assertTransition, plannedDates, normalizedPerson, commandSchema } from "./domain";
import { lifecyclePrincipal, requireLifecyclePermission } from "./access";
const env = { PNT_DOCUMENT_ACCESS_MODE: "trusted-proxy", PNT_DOCUMENT_PROXY_SECRET: "synthetic-test-key-not-a-real-secret" };
describe("P2B permisos y flujo controlado", () => {
  it("write no concede decisiones; cada capacidad sensible es explícita", () => {
    const h = new Headers({ "x-pnt-proxy-secret": env.PNT_DOCUMENT_PROXY_SECRET, "x-pnt-user": "Registrador QA", "x-pnt-permissions": "read,write" });
    const p = lifecyclePrincipal(h, env); expect(p.canWrite).toBe(true);
    for (const permission of ["verify", "accept-approval", "activate", "legacy-register"] as const) expect(() => requireLifecyclePermission(p, permission)).toThrow(/autorizada/);
    h.set("x-pnt-permissions", "read,verify"); expect(() => requireLifecyclePermission(lifecyclePrincipal(h, env), "verify")).not.toThrow();
  });
  it("operación falla cerrada sin identidad y no concede privilegios en demo/explotación", () => {
    expect(() => lifecyclePrincipal(new Headers(), env)).toThrow();
    expect(lifecyclePrincipal(new Headers(), { PNT_DOCUMENT_ACCESS_MODE: "demo", APP_ENV: "demo", PNT_LIFECYCLE_TEST_PERMISSIONS: "activate" }).capabilities).toEqual([]);
    expect(lifecyclePrincipal(new Headers(), { PNT_DOCUMENT_ACCESS_MODE: "demo", APP_ENV: "test", PNT_LIFECYCLE_TEST_PERMISSIONS: "verify" }).capabilities).toEqual(["verify"]);
  });
  it.each(["DRAFT", "IMPORTED_PENDING", "IN_REVIEW", "PENDING_APPROVAL", "OBSOLETE", "ANNULLED"] as const)("bloquea activación desde %s", state => expect(() => assertTransition("ACTIVATE", state)).toThrow());
  it("acepta fases secuenciales, pero no aprobación anticipada ni rectificación de vigente", () => {
    expect(() => assertTransition("VERIFY", "IMPORTED_PENDING")).not.toThrow();
    expect(() => assertTransition("SUBMIT", "IN_REVIEW")).not.toThrow();
    expect(() => assertTransition("PLAN", "PENDING_APPROVAL")).not.toThrow();
    expect(() => assertTransition("REGISTER_EXTERNAL", "IN_REVIEW", "APPROVAL")).toThrow();
    expect(() => assertTransition("RECTIFY", "IN_FORCE")).toThrow();
  });
  it("fechas no permiten retroactividad incoherente, revisión vencida ni plazo inventado", () => {
    expect(() => plannedDates("2026-01-01", "2026-02-01", "2031-02-01", "2026-10-09")).not.toThrow();
    expect(() => plannedDates("2026-02-01", "2026-01-01", "2031-01-01", "2026-10-09")).toThrow();
    expect(() => plannedDates("2026-01-01", "2026-02-01", "2031-02-02", "2026-10-09")).toThrow();
    expect(() => plannedDates("2027-01-01", "2027-02-01", "2031-02-01", "2026-10-09")).toThrow();
  });
  it("normaliza comparación preparador/aprobador sin afirmar identidad corporativa", () => expect(normalizedPerson("  PÉREZ   QA ")).toBe(normalizedPerson("perez qa")));
  it("valida UUID, duplicados, fechas imposibles y no acepta actor del formulario", () => {
    const c = { requestId: randomUUID(), expectedVersion: 0, operation: "VERIFY", reason: "QA", notes: "Contraste", evidenceIds: [randomUUID()] };
    expect(commandSchema.safeParse(c).success).toBe(true);
    for (const extra of [{ actor: "Suplantado" }, { evidenceIds: ["ajeno"] }, { evidenceIds: [c.evidenceIds[0], c.evidenceIds[0]] }, { accreditedDate: "2026-02-31" }, { expectedVersion: -1 }]) expect(commandSchema.safeParse({ ...c, ...extra }).success).toBe(false);
  });
});
