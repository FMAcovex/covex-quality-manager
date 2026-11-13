import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

// FEC1: a las 23:30 UTC del 12 de noviembre en Madrid ya es día 13. Una vigencia del 13 es «de hoy», no futura,
// y el listado de PNT (pantalla y exportación) cuenta lo vigente desde el 13.
const calls: unknown[] = [];
function recorder(overrides: Record<string, unknown> = {}): unknown {
  // Respuesta por «modelo.método» (p. ej. «controlledDocument.findUnique») o por método; si no, vacía.
  const result = (path: string) => {
    const method = path.split(".").pop()!;
    if (path in overrides) return overrides[path];
    if (method in overrides) return overrides[method];
    return method === "count" ? 0 : method.startsWith("find") && method !== "findMany" ? null : [];
  };
  const node = (path: string): unknown => new Proxy(function () {}, {
    get: (_t, key) => typeof key === "string" ? node(path ? `${path}.${key}` : key) : undefined,
    apply: (_t, _this, args) => { calls.push(args); return Promise.resolve(result(path)); },
  });
  return new Proxy({}, { get: (_t, key) => key === "$transaction" ? (fn: (tx: unknown) => unknown) => fn(recorder(overrides)) : typeof key === "string" ? node(key) : undefined });
}
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: recorder() }));
vi.mock("@/lib/auth/context", () => ({ currentIdentity: () => null }));

const recorded = () => JSON.stringify(calls, (_key, value) => value && typeof value === "object" && "values" in value && "strings" in value ? { sql: (value as { strings: string[] }).strings, values: (value as { values: unknown[] }).values } : value);

beforeEach(() => { calls.length = 0; vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-12T23:30:00.000Z")); });
afterEach(() => { vi.useRealTimers(); });

describe("PNT con el día de Madrid (FEC1)", () => {
  it("alta de una revisión existente vigente desde hoy en Madrid", async () => {
    const { validateExistingRevision } = await import("./domain");
    const v = { existingDocument: true, verified: true, sourceReference: "Fuente", existingStatus: "IN_FORCE" as const, effectiveFrom: "2026-11-13", obsoletedAt: "" };
    expect(() => validateExistingRevision(v)).not.toThrow();
    expect(() => validateExistingRevision({ ...v, effectiveFrom: "2026-11-14" })).toThrow();
  });

  it("el registro manual de estado no rechaza como futura la vigencia de hoy en Madrid", async () => {
    const { changeManualRevisionStatus } = await import("./manual-state/service");
    const updatedAt = new Date("2026-11-12T10:00:00.000Z");
    const run = (effectiveFrom: string) => {
      const db = recorder({
        "controlledDocument.findUnique": { id: randomUUID(), administrativeStatus: "ACTIVE", baseCode: "PM-10/950", title: "PNT ficticio", departmentId: randomUUID() },
        "controlledDocumentRevision.findFirst": { id: randomUUID(), status: "DRAFT", updatedAt, revisionCode: "00" },
        "controlledRevisionLifecycle.findUnique": { version: 0, approvalAt: null },
      }) as { $transaction: unknown };
      return changeManualRevisionStatus(randomUUID(), randomUUID(), {
        requestId: randomUUID(), expectedVersion: 0, expectedUpdatedAt: updatedAt.toISOString(), targetStatus: "IN_FORCE",
        reason: "Consta aprobación firmada en papel (ficticio)", effectiveFrom, reviewDueAt: "2029-11-13",
      }, { name: "Garantía de Calidad (ficticio)", source: "TEST_DEMO", capabilities: ["manage-state"] } as never, db as never).then(() => "", (error: Error) => error.message);
    };
    // El PNT simulado falla más adelante (identidad de activación), pero nunca por fecha futura.
    expect(await run("2026-11-13")).not.toMatch(/futura/);
    expect(await run("2026-11-14")).toMatch(/futura/);
  });

  it("el listado de la pantalla y la exportación usan el día de Madrid", async () => {
    const { queryPntListing } = await import("./listing");
    await queryPntListing({ validity: "current" }).catch(() => undefined);
    const text = recorded();
    expect(text).toContain("2026-11-13");
    expect(text).not.toContain("2026-11-12");
  });
});
