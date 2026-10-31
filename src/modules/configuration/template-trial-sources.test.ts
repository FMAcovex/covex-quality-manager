import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  templateFindUnique: vi.fn(),
  findFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  versionFindFirst: vi.fn(),
  planFindFirst: vi.fn(),
  resourceScope: vi.fn(),
  getChangeControlDetail: vi.fn(),
  generateChangeAnnexV: vi.fn(),
  getCapaDetail: vi.fn(),
  generateCapaAnnexIII: vi.fn(),
  getComplaintDetail: vi.fn(),
  generateComplaintAnnexIII: vi.fn(),
  generateAuditReport: vi.fn(),
  getProgrammePreview: vi.fn(),
  generateAnnualProgramme: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const delegate = { findFirst: m.findFirst };
  return { prisma: {
    templateVersion: { findUnique: m.templateFindUnique },
    changeControl: delegate, capa: delegate, complaint: delegate,
    audit: { findFirst: m.findFirst, findUnique: m.auditFindUnique },
    qmsRecordVersion: { findFirst: m.versionFindFirst },
    auditAnnualPlan: { findFirst: m.planFindFirst },
  } };
});
vi.mock("@/lib/auth/resources", () => ({ resourceScope: m.resourceScope }));
vi.mock("@/modules/configuration/template-assets", async (original) => ({ ...(await original<typeof import("@/modules/configuration/template-assets")>()), loadStoredTemplateAsset: async () => Buffer.from("plantilla") }));
vi.mock("@/lib/qms/versioning", async (original) => ({
  ...(await original<typeof import("@/lib/qms/versioning")>()),
  changeControlSnapshotToRecord: (snapshot: unknown) => ({ fromSnapshot: snapshot }),
  capaSnapshotToAnnexRecord: (snapshot: unknown) => ({ fromSnapshot: snapshot }),
  capaSnapshotVersionFollowupDate: (snapshot: unknown, sequence: number) => `fecha ${String(snapshot)} ${sequence}`,
  complaintSnapshotToAnnexRecord: (snapshot: unknown) => ({ fromSnapshot: snapshot }),
}));
vi.mock("@/modules/change-control/queries", () => ({ getChangeControlDetail: m.getChangeControlDetail }));
vi.mock("@/modules/change-control/documents/annex-v", () => ({ generateChangeAnnexV: m.generateChangeAnnexV }));
vi.mock("@/modules/capa/queries", () => ({ getCapaDetail: m.getCapaDetail }));
vi.mock("@/modules/capa/documents/annex-iii", () => ({ generateCapaAnnexIII: m.generateCapaAnnexIII }));
vi.mock("@/modules/complaints/queries", () => ({ getComplaintDetail: m.getComplaintDetail }));
vi.mock("@/modules/complaints/documents/docx", () => ({ generateComplaintAnnexIII: m.generateComplaintAnnexIII, generateComplaintAnnexIV: vi.fn() }));
vi.mock("@/modules/audits/documents/generators", () => ({ generateAuditReport: m.generateAuditReport, generateAuditCapaPlan: vi.fn(), generateAuditExternalPlan: vi.fn() }));
vi.mock("@/modules/audits/report-service", () => ({ auditReportInclude: {}, snapshotAudit: (audit: unknown) => ({ audit }) }));
vi.mock("@/modules/audits/annual-programme/service", () => ({ getProgrammePreview: m.getProgrammePreview }));
vi.mock("@/modules/audits/annual-programme/generator", () => ({ generateAnnualProgramme: m.generateAnnualProgramme }));

import { identityContext, type AccessPermission, type Principal } from "@/lib/auth/context";
import { generateTemplateTrial } from "./template-trial";
import { TemplateTrialError } from "./template-trial-rules";

type GrantSpec = [string, AccessPermission, ("ALL" | "ASSIGNED")?];
const user = (grants: GrantSpec[], departmentIds: string[] = []): Principal => ({ id: "u", tenantId: "t", objectId: "o", name: "Calidad", email: "c@example.invalid", roles: [], active: true, authorized: true, departmentIds, assignments: [], grants: grants.map(([module, permission, scope]) => ({ module: module as Principal["grants"][number]["module"], permission, scope: scope ?? "ALL" })) });
const everything = (module: string) => user([[module, "DOWNLOAD"], [module, "GENERATE_DOCUMENT"]]);
const as = <T>(principal: Principal, run: () => Promise<T>) => identityContext.run({ principal }, run);
const row = (status = "OPEN") => ({ id: "rec-1", status, finalStatus: status, qmsRecord: { businessCode: "X/001/2026", isActive: true } });
const template = (module: string, documentType: string, versionCode = "09") => m.templateFindUnique.mockResolvedValue({ module, documentType, versionCode });

beforeEach(() => {
  vi.clearAllMocks();
  m.findFirst.mockResolvedValue(row());
  m.resourceScope.mockResolvedValue({ id: "qms-1", departmentIds: ["dep-1"] });
  for (const generator of [m.generateChangeAnnexV, m.generateCapaAnnexIII, m.generateComplaintAnnexIII, m.generateAuditReport, m.generateAnnualProgramme]) generator.mockResolvedValue(Buffer.from("doc"));
});

describe("D-129: la prueba rellena lo mismo que la descarga por defecto de la ficha", () => {
  it("Anexo V de Cambios: el seguimiento de la última versión congelada, no el más antiguo", async () => {
    template("CHANGE_CONTROL", "CHANGE_ANNEX_V");
    // Los seguimientos vienen del más reciente al más antiguo; las versiones, en orden ascendente.
    m.getChangeControlDetail.mockResolvedValue({ followups: [{ sequenceNumber: 3 }, { sequenceNumber: 2 }, { sequenceNumber: 1 }], qmsRecord: { versions: [{ sequenceNumber: 1, snapshot: "s1" }, { sequenceNumber: 3, snapshot: "s3" }] } });
    await as(everything("CHANGE_CONTROL"), () => generateTemplateTrial("tpl", null));
    expect(m.generateChangeAnnexV).toHaveBeenCalledWith({ fromSnapshot: "s3", annexVTemplateVersion: { versionCode: "09" } }, 3);
  });

  it("Anexo III de CAPA: número, motivo y fecha de seguimiento de la última versión", async () => {
    template("CAPA", "CAPA_ANNEX_III");
    m.getCapaDetail.mockResolvedValue({ openedAt: "apertura", qmsRecord: { versions: [{ sequenceNumber: 0, snapshot: "s0", reason: "Alta" }, { sequenceNumber: 2, snapshot: "s2", reason: "Seguimiento 2" }] } });
    await as(everything("CAPA"), () => generateTemplateTrial("tpl", null));
    expect(m.generateCapaAnnexIII).toHaveBeenCalledWith({ fromSnapshot: "s2", annexIIITemplateVersion: { versionCode: "09" }, recordVersionSequenceNumber: 2, recordVersionReason: "Seguimiento 2", versionFollowupDate: "fecha s2 2" });
  });

  it("Anexo III de Reclamaciones: la versión del encabezado es la de la última versión congelada", async () => {
    template("COMPLAINT", "COMPLAINT_ANNEX_III");
    m.getComplaintDetail.mockResolvedValue({ qmsRecord: { versions: [{ sequenceNumber: 0, snapshot: "s0" }, { sequenceNumber: 2, snapshot: "s2" }] } });
    await as(everything("COMPLAINT"), () => generateTemplateTrial("tpl", null));
    expect(m.generateComplaintAnnexIII).toHaveBeenCalledWith({ fromSnapshot: "s2", recordVersionLabel: "V02", annexIIITemplateVersion: { versionCode: "09" } });
  });
});

describe("D-129: un fallo de la plantilla de auditoría no se presenta como un problema de la auditoría", () => {
  beforeEach(() => {
    template("AUDIT", "AUDIT_INTERNAL_REPORT");
    m.auditFindUnique.mockResolvedValue({ id: "rec-1", qmsRecordId: "qms-1" });
    m.versionFindFirst.mockResolvedValue({ sequenceNumber: 1 });
  });

  it("una plantilla que no corresponde se propaga como fallo del generador (página «No la actives»)", async () => {
    m.generateAuditReport.mockImplementation(() => { throw new Error("La plantilla no corresponde al escenario."); });
    const error = await as(everything("AUDIT"), () => generateTemplateTrial("tpl", null)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TemplateTrialError);
  });

  it("un dato que le falta a la auditoría se explica y propone otra auditoría", async () => {
    m.generateAuditReport.mockImplementation(() => { throw new Error("El informe externo requiere un código de auditoría para completar el pie de página."); });
    await expect(as(everything("AUDIT"), () => generateTemplateTrial("tpl", null))).rejects.toThrow(/Prueba con otra auditoría/);
  });
});

describe("D-129: permisos en el ámbito del expediente y del plan", () => {
  it("con ámbito «Asignados» solo se prueba con expedientes de sus departamentos", async () => {
    template("CHANGE_CONTROL", "CHANGE_ANNEX_V");
    m.getChangeControlDetail.mockResolvedValue({ followups: [{ sequenceNumber: 1 }], qmsRecord: { versions: [{ sequenceNumber: 1, snapshot: "s1" }] } });
    const assigned = user([["CHANGE_CONTROL", "DOWNLOAD", "ASSIGNED"], ["CHANGE_CONTROL", "GENERATE_DOCUMENT", "ASSIGNED"]], ["dep-1"]);
    await expect(as(assigned, () => generateTemplateTrial("tpl", null))).resolves.toMatchObject({ fileName: expect.stringMatching(/^PRUEBA_CHANGE_ANNEX_V_v09_/) });
    m.resourceScope.mockResolvedValue({ id: "qms-2", departmentIds: ["dep-2"] });
    await expect(as(assigned, () => generateTemplateTrial("tpl", null))).rejects.toMatchObject({ status: 403 });
    expect(m.resourceScope).toHaveBeenCalledWith("CHANGE_CONTROL", "rec-1");
  });

  it("los programas anuales exigen descargar en el ámbito del plan", async () => {
    template("AUDIT", "AUDIT_ANNUAL_INTERNAL_PROGRAMME", "PMAI");
    m.planFindFirst.mockResolvedValue({ id: "plan-1", year: 2026 });
    m.getProgrammePreview.mockResolvedValue({ content: { rows: [] } });
    await expect(as(user([["AUDIT", "MANAGE_CONFIGURATION"]]), () => generateTemplateTrial("tpl", "2026"))).rejects.toMatchObject({ status: 403 });
    expect(m.resourceScope).toHaveBeenCalledWith("AUDIT", "plan-1", "AUDIT_PLAN");
    const file = await as(user([["AUDIT", "DOWNLOAD"]]), () => generateTemplateTrial("tpl", "2026"));
    expect(m.generateAnnualProgramme).toHaveBeenCalledWith(Buffer.from("plantilla"), { rows: [] });
    expect(file.fileName).toBe("PRUEBA_AUDIT_ANNUAL_INTERNAL_PROGRAMME_vPMAI_2026.docx");
  });
});
