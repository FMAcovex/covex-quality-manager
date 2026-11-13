import { beforeEach, describe, expect, it, vi } from "vitest";

// TPL1: la ficha ofrece descargar o generar un anexo solo si la plantilla que usará la generación (la asignada al
// expediente o, si no tiene, la versión por defecto) tiene su archivo instalado, con el mismo criterio que el
// cargador: archivo guardado (fileData) o ruta, y huella registrada. Sin leer los bytes.
type Row = { id: string; module: string; documentType: string; versionCode: string; fileName: string | null; hasData: boolean; filePath: string | null; checksum: string | null };
const rows = new Map<string, Row>();
const installedReady = (row: Row) => Boolean((row.hasData || row.filePath) && row.checksum);
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { templateVersion: {
  findUnique: async ({ where, select }: { where: { id?: string; module_documentType_versionCode?: { module: string; documentType: string; versionCode: string } }; select: Record<string, boolean> }) => {
    if (select.fileData) throw new Error("la ficha no debe leer los bytes de la plantilla");
    const key = where.module_documentType_versionCode;
    const row = where.id ? rows.get(where.id) : [...rows.values()].find((r) => key && r.module === key.module && r.documentType === key.documentType && r.versionCode === key.versionCode);
    return row ? { id: row.id, versionCode: row.versionCode } : null;
  },
  count: async ({ where }: { where: { id: string } }) => { const row = rows.get(where.id); return row && installedReady(row) ? 1 : 0; },
} } }));

const base = { module: "DEVIATION", documentType: "DEVIATION_ANNEX_III" };
const installed = { fileName: "Anexo III.docx", hasData: true, filePath: null, checksum: "a".repeat(64) };
const registeredOnly = { fileName: null, hasData: false, filePath: null, checksum: null };

beforeEach(() => rows.clear());

describe("recordAnnexTemplate", () => {
  it("la plantilla asignada sin archivo no está lista, aunque la de por defecto lo esté", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("assigned", { id: "assigned", ...base, versionCode: "05", ...registeredOnly });
    rows.set("default", { id: "default", ...base, versionCode: "06", ...installed });
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", { id: "assigned", versionCode: "05" }, "06"))
      .toEqual({ id: "assigned", versionCode: "05", assigned: true, ready: false });
  });
  it("la plantilla asignada con archivo está lista", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("assigned", { id: "assigned", ...base, versionCode: "05", ...installed });
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", { id: "assigned", versionCode: "05" }, "06"))
      .toEqual({ id: "assigned", versionCode: "05", assigned: true, ready: true });
  });
  it("sin plantilla asignada usa la de por defecto del mismo módulo y tipo, y dice si tiene archivo", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("other", { id: "other", module: "CAPA", documentType: "CAPA_ANNEX_III", versionCode: "06", ...installed });
    rows.set("default", { id: "default", ...base, versionCode: "06", ...registeredOnly });
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", null, "06"))
      .toEqual({ id: "default", versionCode: "06", assigned: false, ready: false });
    rows.set("default", { id: "default", ...base, versionCode: "06", ...installed });
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", null, "06"))
      .toEqual({ id: "default", versionCode: "06", assigned: false, ready: true });
  });
  it("como el cargador: con nombre y huella pero sin archivo guardado no está lista; con archivo y sin nombre, sí", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("named", { id: "named", ...base, versionCode: "06", fileName: "Anexo III.docx", hasData: false, filePath: null, checksum: "c".repeat(64) });
    expect((await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", { id: "named", versionCode: "06" }, "06"))?.ready).toBe(false);
    rows.set("unnamed", { id: "unnamed", ...base, versionCode: "07", fileName: null, hasData: true, filePath: null, checksum: "d".repeat(64) });
    expect((await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", { id: "unnamed", versionCode: "07" }, "06"))?.ready).toBe(true);
  });
  it("usa el código por defecto que recibe (Reclamaciones, Anexo IV: el del Anexo III, ver template-version)", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    rows.set("iv04", { id: "iv04", module: "COMPLAINT", documentType: "COMPLAINT_ANNEX_IV", versionCode: "04", ...installed });
    rows.set("iv03", { id: "iv03", module: "COMPLAINT", documentType: "COMPLAINT_ANNEX_IV", versionCode: "03", ...registeredOnly });
    expect(await recordAnnexTemplate("COMPLAINT", "COMPLAINT_ANNEX_IV", null, "04")).toEqual({ id: "iv04", versionCode: "04", assigned: false, ready: true });
  });
  it("sin ninguna plantilla registrada devuelve null", async () => {
    const { recordAnnexTemplate } = await import("./template-readiness");
    expect(await recordAnnexTemplate("DEVIATION", "DEVIATION_ANNEX_III", null, "06")).toBeNull();
  });
});
