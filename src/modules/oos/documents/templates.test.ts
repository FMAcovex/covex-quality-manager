import { beforeEach, expect, it, vi } from "vitest";

// TPL1: la ficha de OOS comprueba la plantilla que usará la generación (la vigente en la fecha de emisión), no
// la activa: si la versión de esa fecha no tiene archivo, no se ofrece generar aunque la activa (más reciente) sí.
type Row = { id: string; versionCode: string; effectiveFrom: Date; isActive: boolean; installed: boolean };
let rows: Row[] = [];
vi.mock("@/lib/db", () => ({ prisma: { templateVersion: {
  findMany: async ({ orderBy }: { orderBy: unknown }) => {
    expect(orderBy).toEqual([{ effectiveFrom: "asc" }, { createdAt: "asc" }, { id: "asc" }]);
    return rows.map(({ id, versionCode, effectiveFrom }) => ({ id, versionCode, effectiveFrom }));
  },
  count: async ({ where }: { where: { id: string } }) => rows.filter((row) => row.id === where.id && row.installed).length,
} } }));

beforeEach(() => { rows = []; });

it("usa la plantilla vigente en la fecha de emisión, no la activa", async () => {
  const { oosTemplateReady } = await import("./templates");
  rows = [
    { id: "v04", versionCode: "04", effectiveFrom: new Date("2026-01-01"), isActive: false, installed: false },
    { id: "v05", versionCode: "05", effectiveFrom: new Date("2026-10-01"), isActive: true, installed: true },
  ];
  expect(await oosTemplateReady("OOS_ANNEX_III", new Date("2026-06-15"))).toBe(false);
  expect(await oosTemplateReady("OOS_ANNEX_III", new Date("2026-10-15"))).toBe(true);
  expect(await oosTemplateReady("OOS_ANNEX_III", null)).toBe(true);
});

it("sin ninguna plantilla registrada no está lista", async () => {
  const { oosTemplateReady } = await import("./templates");
  expect(await oosTemplateReady("OOS_ANNEX_IV", new Date("2026-06-15"))).toBe(false);
});
