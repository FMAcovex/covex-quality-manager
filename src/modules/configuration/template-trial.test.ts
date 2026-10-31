import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  templateFindUnique: vi.fn(),
  deviationFindFirst: vi.fn(),
  loadStoredTemplateAsset: vi.fn(),
  getDeviationDetail: vi.fn(),
  generateAnnexIII: vi.fn(),
  getCapaExportRows: vi.fn(),
  generateCapaAnnexIV: vi.fn(),
  resourceScope: vi.fn(),
}));

vi.mock("server-only", () => ({}));
// Solo lecturas: si la prueba intentara guardar algo (documento de trabajo, recibo), no existiría el método y fallaría.
vi.mock("@/lib/db", () => ({ prisma: { templateVersion: { findUnique: mocks.templateFindUnique }, deviation: { findFirst: mocks.deviationFindFirst } } }));
vi.mock("@/lib/auth/resources", () => ({ resourceScope: mocks.resourceScope }));
vi.mock("@/modules/configuration/template-assets", async (original) => ({ ...(await original<typeof import("@/modules/configuration/template-assets")>()), loadStoredTemplateAsset: mocks.loadStoredTemplateAsset }));
vi.mock("@/modules/deviations/queries", () => ({ getDeviationDetail: mocks.getDeviationDetail }));
vi.mock("@/modules/deviations/documents/annex-iii", () => ({ generateAnnexIII: mocks.generateAnnexIII }));
vi.mock("@/modules/capa/documents/export-data", () => ({ getCapaExportRows: mocks.getCapaExportRows }));
vi.mock("@/modules/capa/documents/xlsx", () => ({ generateCapaAnnexIV: mocks.generateCapaAnnexIV }));
vi.mock("@/lib/qms/working-document", () => ({ storeWorkingDocument: () => { throw new Error("La prueba no debe guardar documentos de trabajo."); } }));

import { identityContext, type AccessPermission, type Principal } from "@/lib/auth/context";
import { generateTemplateTrial } from "./template-trial";
import { TemplateTrialError } from "./template-trial-rules";

const user = (grants: Array<[string, AccessPermission]>): Principal => ({ id: "u", tenantId: "t", objectId: "o", name: "Calidad", email: "calidad@example.invalid", roles: [], active: true, authorized: true, departmentIds: [], assignments: [], grants: grants.map(([module, permission]) => ({ module: module as Principal["grants"][number]["module"], permission, scope: "ALL" })) });
const quality = user([["DEVIATION", "MANAGE_CONFIGURATION"], ["DEVIATION", "DOWNLOAD"], ["DEVIATION", "GENERATE_DOCUMENT"], ["CAPA", "EXPORT"]]);
const as = <T>(principal: Principal, run: () => Promise<T>) => identityContext.run({ principal }, run);
const openDeviation = { id: "dev-1", status: "OPEN", qmsRecord: { businessCode: "D/GC-00/001/2026", isActive: true } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadStoredTemplateAsset.mockResolvedValue(Buffer.from("plantilla"));
  mocks.resourceScope.mockResolvedValue({ id: "qms-1", departmentIds: ["dep-1"] });
  mocks.templateFindUnique.mockResolvedValue({ module: "DEVIATION", documentType: "DEVIATION_ANNEX_III", versionCode: "07" });
  mocks.deviationFindFirst.mockResolvedValue(openDeviation);
  mocks.getDeviationDetail.mockResolvedValue({ id: "dev-1", anexoIIITemplateVersion: { versionCode: "06" }, qmsRecord: { versions: [{ sequenceNumber: 0 }, { sequenceNumber: 2 }] } });
  mocks.generateAnnexIII.mockResolvedValue(Buffer.from("docx"));
  mocks.getCapaExportRows.mockResolvedValue([{ id: "fila" }]);
  mocks.generateCapaAnnexIV.mockResolvedValue(Buffer.from("xlsx"));
});

describe("D-129: probar una versión de plantilla con un expediente", () => {
  it("genera con la versión probada (no con la del expediente) y el último expediente con código fuera de borrador", async () => {
    const file = await as(quality, () => generateTemplateTrial("tpl-07", null));
    expect(mocks.generateAnnexIII).toHaveBeenCalledWith(expect.objectContaining({ anexoIIITemplateVersion: { versionCode: "07" }, recordVersionLabel: "V02" }));
    expect(mocks.loadStoredTemplateAsset).toHaveBeenCalledWith("DEVIATION", "DEVIATION_ANNEX_III", "07");
    const query = mocks.deviationFindFirst.mock.calls[0][0];
    expect(query.where).toEqual({ status: { not: "DRAFT" }, qmsRecord: { isActive: true, businessCode: { not: null } } });
    expect(query.orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
    expect(file).toEqual({ buffer: Buffer.from("docx"), fileName: "PRUEBA_DEVIATION_ANNEX_III_v07_D_GC-00_001_2026.docx", mimeType: expect.stringContaining("wordprocessingml") });
  });

  it("con un código, busca ese expediente sin distinguir mayúsculas", async () => {
    await as(quality, () => generateTemplateTrial("tpl-07", " d/gc-00/001/2026 "));
    expect(mocks.deviationFindFirst.mock.calls[0][0].where).toEqual({ qmsRecord: { businessCode: { equals: "d/gc-00/001/2026", mode: "insensitive" } } });
  });

  it("un expediente en borrador, anulado o inexistente se explica y no se genera", async () => {
    for (const [row, message, status] of [
      [{ ...openDeviation, status: "DRAFT" }, "está en borrador", 409],
      [{ ...openDeviation, qmsRecord: { ...openDeviation.qmsRecord, isActive: false } }, "está anulado", 409],
      [null, "No hay ningún expediente de Desviaciones con el código «X-1»", 404],
    ] as const) {
      mocks.deviationFindFirst.mockResolvedValueOnce(row);
      const error = await as(quality, () => generateTemplateTrial("tpl-07", "X-1")).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(TemplateTrialError);
      expect((error as TemplateTrialError).message).toContain(message);
      expect((error as TemplateTrialError).status).toBe(status);
    }
    expect(mocks.generateAnnexIII).not.toHaveBeenCalled();
  });

  it("exige los permisos de la descarga normal en el ámbito del expediente, no solo gestionar la configuración", async () => {
    for (const principal of [user([["DEVIATION", "MANAGE_CONFIGURATION"]]), user([["DEVIATION", "MANAGE_CONFIGURATION"], ["DEVIATION", "DOWNLOAD"]])]) {
      await expect(as(principal, () => generateTemplateTrial("tpl-07", null))).rejects.toMatchObject({ status: 403 });
    }
    expect(mocks.resourceScope).toHaveBeenCalledWith("DEVIATION", "dev-1");
    expect(mocks.generateAnnexIII).not.toHaveBeenCalled();
  });

  it("los listados se prueban con un año y exigen el permiso de exportar", async () => {
    mocks.templateFindUnique.mockResolvedValue({ module: "CAPA", documentType: "CAPA_ANNEX_IV", versionCode: "06" });
    const file = await as(quality, () => generateTemplateTrial("tpl-capa", "2025"));
    expect(mocks.getCapaExportRows).toHaveBeenCalledWith({ year: ["2025"] });
    expect(mocks.generateCapaAnnexIV).toHaveBeenCalledWith(2025, [{ id: "fila" }], "06");
    expect(file.fileName).toBe("PRUEBA_CAPA_ANNEX_IV_v06_2025.xlsx");
    await expect(as(user([["CAPA", "MANAGE_CONFIGURATION"]]), () => generateTemplateTrial("tpl-capa", "2025"))).rejects.toMatchObject({ status: 403 });
  });

  it("una versión sin archivo guardado no se prueba", async () => {
    mocks.loadStoredTemplateAsset.mockResolvedValue(null);
    await expect(as(quality, () => generateTemplateTrial("tpl-07", null))).rejects.toThrow("no tiene archivo de plantilla guardado");
  });
});
