import { beforeEach, expect, it, vi } from "vitest";

// TPL1: la ficha de OOS comprueba la plantilla que usará la generación (la vigente en la fecha de emisión),
// no la activa: si la versión de esa fecha no tiene archivo, no se ofrece generar aunque la activa lo tenga.
let candidates: Array<{ effectiveFrom: Date; fileName: string | null; filePath: string | null; checksum: string | null }> = [];
vi.mock("@/lib/db", () => ({ prisma: { templateVersion: { findMany: async () => candidates } } }));

const file = { fileName: "PNT GC-10-014-04.docx", filePath: null, checksum: "b".repeat(64) };
const noFile = { fileName: null, filePath: null, checksum: null };
beforeEach(() => { candidates = []; });

it("usa la plantilla vigente en la fecha de emisión del OOS", async () => {
  const { oosTemplateReady } = await import("./templates");
  candidates = [
    { effectiveFrom: new Date("2026-01-01"), ...noFile },
    { effectiveFrom: new Date("2026-10-01"), ...file },
  ];
  expect(await oosTemplateReady("OOS_ANNEX_III", new Date("2026-06-15"))).toBe(false);
  expect(await oosTemplateReady("OOS_ANNEX_III", new Date("2026-10-15"))).toBe(true);
  expect(await oosTemplateReady("OOS_ANNEX_III", null)).toBe(true);
});

it("sin ninguna plantilla registrada no está lista", async () => {
  const { oosTemplateReady } = await import("./templates");
  expect(await oosTemplateReady("OOS_ANNEX_IV", new Date("2026-06-15"))).toBe(false);
});
