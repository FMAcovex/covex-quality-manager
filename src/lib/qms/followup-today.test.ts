import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FEC1: los filtros y contadores de seguimientos de los listados comparan con el día de Madrid. A las 23:30 UTC del
// 12 de noviembre en Madrid ya es día 13: lo previsto para el 13 ya está pendiente («hoy»), no programado.
const calls: unknown[] = [];
function recorder(): unknown {
  const result = (name: string) => name === "count" ? 0 : name === "$queryRaw" ? [{ count: 0 }] : name.startsWith("findFirst") || name.startsWith("findUnique") ? null : [];
  const node = (name: string): unknown => new Proxy(function () {}, {
    get: (_t, key) => typeof key === "string" ? node(key) : undefined,
    apply: (_t, _this, args) => { calls.push(args); return Promise.resolve(result(name)); },
  });
  return new Proxy({}, { get: (_t, key) => typeof key === "string" ? node(key) : undefined });
}
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: recorder() }));
vi.mock("@/lib/auth/context", () => ({ currentIdentity: () => null }));
vi.mock("@/lib/qms/review/list-queries", () => ({ withActiveReviewCounts: async (rows: unknown[]) => rows }));
vi.mock("@/lib/qms/additional-lots-search", () => ({ idsWithAdditionalLot: async () => [] }));

const madridToday = "2026-11-13T00:00:00.000Z";
const serverInstant = "2026-11-12T23:30:00.000Z";
const recorded = () => JSON.stringify(calls, (_key, value) => value && typeof value === "object" && "values" in value && "strings" in value ? { sql: (value as { strings: string[] }).strings, values: (value as { values: unknown[] }).values } : value);

beforeEach(() => { calls.length = 0; vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(serverInstant)); });
afterEach(() => { vi.useRealTimers(); });

describe("seguimientos con el día de Madrid", () => {
  it("CAPA: filtro y contador", async () => {
    const { getCapaList } = await import("@/modules/capa/queries");
    await getCapaList({ followup: "due" });
    expect(recorded()).toContain(madridToday);
    expect(recorded()).not.toContain(serverInstant);
  });
  it("Desviaciones: contador", async () => {
    const { getDeviationList } = await import("@/modules/deviations/queries");
    await getDeviationList({});
    expect(recorded()).toContain(madridToday);
    expect(recorded()).not.toContain(serverInstant);
  });
  it("Controles de cambios: contador", async () => {
    const { getChangeControlList } = await import("@/modules/change-control/queries");
    await getChangeControlList({});
    expect(recorded()).toContain(madridToday);
    expect(recorded()).not.toContain(serverInstant);
  });
  it("Devoluciones: filtro sin CURRENT_DATE de la sesión de PostgreSQL", async () => {
    const { returnListWhere } = await import("@/modules/returns/queries");
    await returnListWhere({ followup: "DUE" });
    expect(recorded()).toContain(madridToday);
    expect(recorded()).not.toContain("CURRENT_DATE");
  });
  it("Reclamaciones: filtro y contador", async () => {
    const { getComplaintList } = await import("@/modules/complaints/queries");
    await getComplaintList({ followup: ["OVERDUE"] });
    const text = recorded();
    expect(text).toContain(madridToday);
    expect(text).not.toContain("2026-11-12T00:00:00.000Z");
  });
  it("Reclamaciones: el distintivo de la fila y la ficha", async () => {
    process.env.TZ = "UTC";
    const { complaintFollowupState } = await import("@/modules/complaints/domain");
    expect(complaintFollowupState({ status: "OPEN", nextFollowupDate: "2026-11-12T00:00:00.000Z" })).toBe("OVERDUE");
    expect(complaintFollowupState({ status: "OPEN", nextFollowupDate: "2026-11-13T00:00:00.000Z" })).toBe("PENDING");
  });
});
