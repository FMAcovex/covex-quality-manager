import { describe, expect, it } from "vitest";
import { syntheticAuditCapaPlan, syntheticCapaPlanAnnexIV } from "../../../../scripts/audits-r3c-fixtures";
import { generateAuditCapaPlan } from "./generators";
import { getZipEntryText, readZip } from "@/lib/ooxml/zip";
import { capaPlanBlocks, capaPlanCapaStatus, type CapaPlanLinks } from "../capa-plan-annex";
import { capaPlanSignatoryFields, signatoriesFromForm } from "../signatories";
import type { AuditReportSnapshot } from "../report-service";

// D-136 (R6): plan CAPA del Anexo IV (GC-00/033/04). Datos ficticios.
const finding = (id: string, reference: string, extra: Record<string, unknown> = {}) => ({ id, reference, findingType: "FINDING", criticality: "MAJOR", isActive: true, description: `Descripción ${reference}`, rootCause: null, treatment: "", treatmentStatus: "OPEN", closedAt: null, evidence: null, evidenceReference: null, actions: [], relations: [], ...extra });
const capa = (code: string, extra: Record<string, unknown> = {}) => ({ code, status: "OPEN", effectivenessStatus: "PENDING", responsible: ["FMA"], plannedDate: "2097-05-05", closedAt: null, actions: [`Acción de ${code}`], ...extra });
const links: CapaPlanLinks = {
  f1: { deviations: [{ code: "D/GC-00/001/2097", rootCause: "Causa de la desviación" }], capas: [capa("AC/1"), capa("AC/2", { status: "CLOSED", closedAt: "2097-05-07" }), capa("AP/3", { status: "CLOSED", effectivenessStatus: "CONFORMING", closedAt: "2097-05-30", responsible: ["RRA", "JFV"] })] },
  f2: { deviations: [{ code: "D/GC-00/002/2097", rootCause: null }], capas: [] },
};
function snapshot(capaPlan?: CapaPlanLinks): AuditReportSnapshot {
  return { schemaVersion: 1, templates: [], capaPlan, audit: {
    id: "a", scenario: "INTERNAL_COVEX", qmsRecord: { businessCode: "AI/GC-00/01/2097", generatedDocuments: [] }, externalReference: null,
    departments: [{ isActive: true, departmentNameSnapshot: "Garantía de Calidad" }], title: "Objeto", auditedEntityName: null, auditingEntityName: null,
    performedDate: "2097-03-10", reportDate: "2097-03-20",
    signatories: [{ document: "CAPA_PLAN", role: "PREPARED", name: "Elaboradora", position: "Técnica GC" }, { document: "CAPA_PLAN", role: "REVIEWED", name: "Revisor 1", position: "" }, { document: "CAPA_PLAN", role: "REVIEWED", name: "Revisor 2", position: "DT" }, { document: "CAPA_PLAN", role: "APPROVED", name: "Aprobadora", position: "Dirección GC" }, { document: "REPORT", role: "PREPARED", name: "No es del plan", position: "" }],
    findings: [
      finding("f1", "OBS 01", { treatment: "Justificación libre", evidenceReference: "REG-1" }),
      finding("f2", "OBS 02", { criticality: "MINOR", actions: [{ isActive: true, description: "Acción propia", responsible: "RRA", targetDate: "2097-06-01", status: "IN_PROGRESS", closedAt: null, evidence: "Registro", evidenceReference: null }] }),
      finding("f3", "OBS 03", { criticality: "CRITICAL", rootCause: "Causa escrita a mano" }),
      finding("f4", "Rk 01", { findingType: "RECOMMENDATION", criticality: "NA" }),
      finding("f5", "OBS 99", { isActive: false }),
    ],
  } as unknown as AuditReportSnapshot["audit"] };
}
const sheetOf = (bytes: Buffer) => getZipEntryText(readZip(bytes), "xl/worksheets/sheet1.xml");
const cell = (sheet: string, ref: string) => {
  const m = sheet.match(new RegExp(`<c r="${ref}"[^>]*?(?:/>|>([\\s\\S]*?)</c>)`));
  return m?.[1] ? (m[1].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? m[1].match(/<v>([^<]*)<\/v>/)?.[1] ?? "") : "";
};

describe("D-136 · bloques del plan CAPA", () => {
  it("una fila por CAPA de la desviación, con su responsable, fecha, estado y cierre", () => {
    const [b1] = capaPlanBlocks(snapshot().audit.findings as never, links);
    expect([b1.reference, b1.criticality, b1.deviations, b1.rootCause]).toEqual(["OBS 01", "Mayor", "D/GC-00/001/2097", "Causa de la desviación"]);
    expect(b1.rows).toEqual([
      { code: "AC/1", responsible: "FMA", plannedDate: "05/05/2097", status: "Abierta", closedAt: "Pendiente" },
      { code: "AC/2", responsible: "FMA", plannedDate: "05/05/2097", status: "Pendiente", closedAt: "Pendiente" },
      { code: "AP/3", responsible: "RRA\nJFV", plannedDate: "05/05/2097", status: "Cerrada", closedAt: "30/05/2097" },
    ]);
    expect(b1.actions).toBe("AC/1: Acción de AC/1\nAC/2: Acción de AC/2\nAP/3: Acción de AP/3\nJustificación libre");
    expect(b1.evidence).toBe("REG-1");
  });
  it("causa raíz pendiente de la desviación, acción propia sin código, causa escrita sin desviación y recomendación", () => {
    const [, b2, b3, b4, b5] = capaPlanBlocks(snapshot().audit.findings as never, links);
    expect(b5).toBeUndefined();
    expect([b2.rootCause, b2.rows]).toEqual(["Pendiente de investigación (D/GC-00/002/2097)", [{ code: "", responsible: "RRA", plannedDate: "01/06/2097", status: "Abierta", closedAt: "Pendiente" }]]);
    expect([b2.actions, b2.evidence]).toEqual(["Acción propia", "Registro"]);
    expect([b3.criticality, b3.rootCause, b3.deviations]).toEqual(["Crítica", "Causa escrita a mano", ""]);
    expect([b4.criticality, b4.rows.length]).toEqual(["Recomendación", 1]);
  });
  it("estados acordados con Calidad, también cancelada y no eficaz", () => {
    expect([["OPEN", "PENDING"], ["DRAFT", "PENDING"], ["CLOSED", "PENDING"], ["CLOSED", "CONFORMING"], ["CLOSED", "NA"], ["CLOSED", "NONCONFORMING"], ["CANCELLED", "PENDING"]]
      .map(([status, effectivenessStatus]) => capaPlanCapaStatus({ status, effectivenessStatus })))
      .toEqual(["Abierta", "Abierta", "Pendiente", "Cerrada", "Cerrada", "Cerrada (no eficaz)", "Cerrada (cancelada)"]);
  });
  it("sin vínculos (fotos anteriores a D-136), los bloques salen solo con los datos del hallazgo", () => {
    const [b1] = capaPlanBlocks(snapshot().audit.findings as never, undefined);
    expect([b1.deviations, b1.rows.length, b1.actions]).toEqual(["", 1, "Justificación libre"]);
  });
});

describe("D-136 · Anexo IV en Excel", () => {
  const sheet = sheetOf(generateAuditCapaPlan(syntheticCapaPlanAnnexIV(), snapshot(links), 1));
  it("cabecera: área, código, fechas, versión, tipo y entidad auditora", () => {
    expect(["C4", "E4", "J4", "C5", "E5"].map(r => cell(sheet, r))).toEqual(["Garantía de Calidad", "AI/GC-00/01/2097", "01", "Auditoría Interna", "COVEX"]);
    expect(cell(sheet, "H4")).toBe("10/3/2097");
  });
  it("bloque con tres CAPA: columnas del hallazgo combinadas en vertical y fechas como fechas de Excel", () => {
    expect(["A8", "B8", "D8", "E8", "F8", "F9", "F10", "G10", "I9", "J10"].map(r => cell(sheet, r))).toEqual(["OBS 01", "Mayor", "D/GC-00/001/2097", "Causa de la desviación", "AC/1", "AC/2", "AP/3", "RRA\nJFV", "Pendiente", "72105"]);
    expect(cell(sheet, "H8")).toBe("72080");
    for (const m of ["A8:A12", "B8:B10", "C8:C10", "D8:D10", "E8:E10", "B11:G11", "H11:J11", "B12:G12", "H12:J12"]) expect(sheet).toContain(`<mergeCell ref="${m}"/>`);
    expect(cell(sheet, "B11")).toBe("Acciones / Justificación /Observaciones");
    expect(cell(sheet, "B12")).toContain("Justificación libre");
    expect(cell(sheet, "H12")).toBe("REG-1");
  });
  it("un bloque por hallazgo activo, firmas desplazadas y listas desplegables en las filas nuevas", () => {
    // OBS 01: 3+2 filas (8–12); OBS 02: 13–15; OBS 03: 16–18; Rk 01: 19–21; separación 22, FIRMAS 23, firmas 24.
    expect(["A13", "A16", "A19"].map(r => cell(sheet, r))).toEqual(["OBS 02", "OBS 03", "Rk 01"]);
    expect(cell(sheet, "A23")).toBe("FIRMAS");
    expect(cell(sheet, "A24")).toBe("Elaborado por: Elaboradora (Técnica GC)     ·     Revisado por: Revisor 1; Revisor 2 (DT)     ·     Aprobado por: Aprobadora (Dirección GC)");
    expect(sheet).toContain('<mergeCell ref="A24:J24"/>');
    expect(sheet).toMatch(/sqref="B8 B13 B16 B19"/);
    expect(sheet).toMatch(/sqref="I8 I9 I10 I13 I16 I19"/);
    expect(sheet).toContain('<dimension ref="A1:K24"/>');
    expect(sheet).not.toMatch(/<row r="2[5-9]"/);
  });
  it("área de impresión hasta las firmas", () => {
    expect(getZipEntryText(readZip(generateAuditCapaPlan(syntheticCapaPlanAnnexIV(), snapshot(links), 0)), "xl/workbook.xml")).toContain("$A$1:$J$24");
  });
  it("la plantilla A4.03 anterior sigue con su generador", () => {
    expect(sheetOf(generateAuditCapaPlan(syntheticAuditCapaPlan(), snapshot(links), 0))).not.toContain("Causa de la desviación");
  });
});

describe("D-136 · firmantes del plan CAPA", () => {
  it("elaborador, revisores y aprobadores, una persona por línea", () => {
    const { list, errors } = signatoriesFromForm({ capaPlanPreparedBy: "Ana | Técnica", capaPlanReviewedBy: "Rosa\nRaúl | DT", capaPlanApprovedBy: "" }, capaPlanSignatoryFields, "CAPA_PLAN");
    expect(errors).toEqual({});
    expect(list.map(s => [s.document, s.role, s.name, s.position])).toEqual([["CAPA_PLAN", "PREPARED", "Ana", "Técnica"], ["CAPA_PLAN", "REVIEWED", "Rosa", ""], ["CAPA_PLAN", "REVIEWED", "Raúl", "DT"]]);
    expect(signatoriesFromForm({ capaPlanPreparedBy: " | Puesto sin nombre" }, capaPlanSignatoryFields, "CAPA_PLAN").errors).toHaveProperty("capaPlanPreparedBy");
  });
});
