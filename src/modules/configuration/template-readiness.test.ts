import { beforeEach, describe, expect, it, vi } from "vitest";

// TPL1: la ficha ofrece descargar o generar un anexo solo si la plantilla que usará la generación (la asignada al
// expediente o, si no tiene, la versión por defecto) tiene su archivo instalado.
const rows = new Map<string, { id: string; versionCode: string; fileName: string | null; filePath: string | null; checksum: string | null }>();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { templateVersion: {
  findUnique: async ({ where }: { where: { id?: string; module_documentType_versionCode?: { versionCode: string } } }) =>
    where.id ? rows.get(where.id) ?? null : [...rows.values()].find((row) => row.versionCode === where.module_documentType_versionCode?.versionCode) ?? null,
} } }));

const installed = { fileName: "Anexo III.docx", filePath: null, checksum: "a".repeat(64) };
const registeredOnly = { fileName: null, filePath: null, checksum: null };

beforeEach(() => rows.clear());

describe("recordAnnexTemplate", () => {
  it("la plantilla asignada sin archivo no está lista, aunque la de por defecto lo esté", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("assigned", { id: "assigned", versionCode: "05", ...registeredOnly });
    rows.set("default", { id: "default", versionCode: "06", ...installed });
    const result = await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", { id: "assigned", versionCode: "05" }, "06");
    expect(result).toEqual({ id: "assigned", versionCode: "05", assigned: true, ready: false });
  });
  it("la plantilla asignada con archivo está lista", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("assigned", { id: "assigned", versionCode: "05", ...installed });
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", { id: "assigned", versionCode: "05" }, "06"))
      .toEqual({ id: "assigned", versionCode: "05", assigned: true, ready: true });
  });
  it("sin plantilla asignada usa la de por defecto, y dice si tiene archivo", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("default", { id: "default", versionCode: "06", ...registeredOnly });
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", null, "06"))
      .toEqual({ id: "default", versionCode: "06", assigned: false, ready: false });
    rows.set("default", { id: "default", versionCode: "06", ...installed });
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", null, "06"))
      .toEqual({ id: "default", versionCode: "06", assigned: false, ready: true });
  });
  it("sin ninguna plantilla registrada devuelve null", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", null, "06")).toBeNull();
  });
});
