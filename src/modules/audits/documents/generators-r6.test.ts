import { describe, expect, it } from "vitest";
import { syntheticAuditReport, syntheticAuditReportR6, syntheticAuditPlanR6 } from "../../../../scripts/audits-r3c-fixtures";
import { generateAuditReport, generateAuditExternalPlan } from "./generators";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import type { AuditReportSnapshot } from "../report-service";

// D-134 (R6): informes 04 (interno) y 05 (externo) y plan de auditoría 05. Datos ficticios.
const finding = (reference: string, criticality: string, extra: Record<string, unknown> = {}) => ({ id: reference, reference, findingType: "FINDING", criticality, isActive: true, description: `Deficiencia ${reference}`, criterionReference: `Requisito ${reference}`, objectiveEvidence: `Evidencia ${reference}`, treatmentStatus: "OPEN", actions: [], relations: [], ...extra });
function snapshot(supplier = false, signatories: unknown = []): AuditReportSnapshot {
  return { schemaVersion: 1, templates: [], audit: {
    id: "audit-uuid", scenario: supplier ? "SUPPLIER" : "INTERNAL_COVEX", qmsRecord: { businessCode: supplier ? "AE/PROV1/01/2096" : "AI/GC-00/01/2096", generatedDocuments: [] },
    departments: [{ isActive: true, departmentCodeSnapshot: "GC-00", departmentNameSnapshot: "Garantía de Calidad" }],
    participants: [
      { isActive: true, role: "LEAD_AUDITOR", displayName: "Auditora ficticia", position: "Técnica GC", organization: null },
      { isActive: true, role: "AUDITEE", displayName: "Auditado ficticio", position: "Jefe de área", organization: null },
    ],
    findings: [finding("OBS 01", "MAJOR"), finding("OBS 02", "MINOR"), { ...finding("Rk 01", "NA"), findingType: "RECOMMENDATION", description: "Mejora ficticia" }],
    signatories, preparedBy: "Legado elabora", preparedPosition: "Puesto legado", reviewedBy: "Legado revisa", reviewedPosition: null, receivedBy: null, receivedPosition: null,
    title: "Objeto", scope: "Alcance", referenceText: "EU GMP Parte I, cap. 9", performedDate: "2096-10-07", reportDate: "2096-10-08", conclusion: "Conclusión ficticia",
    previousAuditBackground: "Antecedentes ficticios", programme: "09:00 | Revisión", auditedEntityName: "Proveedor ficticio", supplierType: "API", auditedEntityAddress: "Dirección ficticia", auditedContact: "contacto@ficticio",
  } as unknown as AuditReportSnapshot["audit"] };
}
const docXml = (bytes: Buffer) => getZipEntryText(readZip(bytes), "word/document.xml");
const text = (xml: string) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("");
function cells(xml: string, table: number) {
  const tbl = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)][table][0];
  return [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(r => [...r[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map(c => text(c[0]).trim()));
}
const signatories = [
  { document: "REPORT", role: "PREPARED", name: "Ana Ficticia", position: "Técnica GC" },
  { document: "REPORT", role: "REVIEWED", name: "Rosa Revisora", position: "Directora Técnica" },
  { document: "REPORT", role: "REVIEWED", name: "Raúl Revisor", position: "Responsable MA" },
  { document: "REPORT", role: "APPROVED", name: "Alba Aprobadora", position: "Directora GC" },
  { document: "REPORT", role: "RECEIVED", name: "Rafa Recibe", position: "Jefe de área" },
  { document: "CAPA_PLAN", role: "PREPARED", name: "No es del informe", position: "" },
];

describe("D-134 · informes de auditoría 04/05", () => {
  it("interno 04: cabecera con normativa, fechas en su fila y personal en sus filas", () => {
    const rows = cells(docXml(generateAuditReport(syntheticAuditReportR6(), snapshot(false, signatories), 0)), 1);
    expect(rows[0][1]).toBe("GC-00 · Garantía de Calidad");
    expect([rows[1][1], rows[1][3]]).toEqual(["AI/GC-00/01/2096", "00"]);
    expect([rows[2][1], rows[2][3]]).toEqual(["7/10/2096", "8/10/2096"]);
    expect(rows[3][1]).toBe("ObjetoAlcance");
    expect(rows[4][1]).toBe("EU GMP Parte I, cap. 9");
    expect(rows[8].slice(0, 2)).toEqual(["Auditado ficticio", "Jefe de área"]);
    expect(rows[11].slice(0, 2)).toEqual(["Auditora ficticia", "Técnica GC"]);
  });

  it("cuadro de firmas: una fila por persona, con revisores y aprobadores por separado", () => {
    const rows = cells(docXml(generateAuditReport(syntheticAuditReportR6(), snapshot(false, signatories), 0)), 2);
    expect(rows.map(r => r.slice(0, 3))).toEqual([
      ["Función", "Nombre y Apellidos", "Puesto"],
      ["Elaborado por", "Ana Ficticia", "Técnica GC"],
      ["Revisado por", "Rosa Revisora", "Directora Técnica"],
      ["Revisado por", "Raúl Revisor", "Responsable MA"],
      ["Aprobado por", "Alba Aprobadora", "Directora GC"],
      ["Recibido por Responsable/s del área auditada", "Rafa Recibe", "Jefe de área"],
    ]);
    expect(rows.slice(1).every(r => r[3] === "" && r[4] === "")).toBe(true);
  });

  it("sin firmantes registrados usa los campos anteriores y deja una fila vacía por función", () => {
    const rows = cells(docXml(generateAuditReport(syntheticAuditReportR6(), snapshot(), 0)), 2);
    expect(rows.map(r => r.slice(0, 3))).toEqual([
      ["Función", "Nombre y Apellidos", "Puesto"],
      ["Elaborado por", "Legado elabora", "Puesto legado"],
      ["Revisado por", "Legado revisa", ""],
      ["Aprobado por", "", ""],
      ["Recibido por Responsable/s del área auditada", "", ""],
    ]);
  });

  it("listado de observaciones con referencia (interno) y detalle OBS por requisito, evidencia y deficiencia", () => {
    const xml = docXml(generateAuditReport(syntheticAuditReportR6(), snapshot(false, signatories), 0));
    const list = cells(xml, 4);
    expect(list[4]).toEqual(["OBS 01", "Deficiencia OBS 01", "Requisito OBS 01"]);
    expect(list[6]).toEqual(["OBS 02", "Deficiencia OBS 02", "Requisito OBS 02"]);
    const body = text(xml);
    expect(body).toContain("OBS 01 – Requisito de referencia: Requisito OBS 01");
    expect(body).toContain("Evidencia objetiva: Evidencia OBS 01");
    expect(body).toContain("Deficiencia detectada: Deficiencia OBS 01");
    expect(body).toContain("OBS 02 – Requisito de referencia: Requisito OBS 02");
    expect(body).not.toContain("Rk 01 – Requisito");
    expect(body).not.toMatch(/OBS XX|Ejemplo \(dividir|RkXX/);
    expect(body).toContain("Rk 01: Mejora ficticia");
    expect(body).toContain("Antecedentes ficticios");
    expect(body).toContain("Conclusión ficticia");
  });

  it("externo 05: mismas posiciones de cabecera que la 04 y listado sin referencia", () => {
    const xml = docXml(generateAuditReport(syntheticAuditReportR6(true), snapshot(true, signatories), 1));
    const head = cells(xml, 1);
    expect([head[0][1], head[0][3], head[1][1], head[1][5]]).toEqual(["Proveedor ficticio", "7/10/2096", "AE/PROV1/01/2096", "01"]);
    expect(head[9].slice(0, 2)).toEqual(["Auditado ficticio", "Jefe de área"]);
    expect(cells(xml, 4)[4]).toEqual(["OBS 01", "Deficiencia OBS 01"]);
    expect(cells(xml, 2)[5][0]).toBe("Recibido por Responsable/s de entidad auditada");
  });

  it("las plantillas anteriores siguen con su cuadro de firmas de tres columnas", () => {
    const rows = cells(docXml(generateAuditReport(syntheticAuditReport(), snapshot(false, signatories), 0)), 2);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toContain("Legado elabora");
  });

  it("plan de auditoría 05: se rellena el anexo suelto, sin recortar un PNT", () => {
    const s = snapshot(true);
    Object.assign(s.audit, { plannedDate: "2096-09-01", planIntroduction: "Introducción ficticia", activityDuration: "09:00–14:00" });
    const body = text(docXml(generateAuditExternalPlan(syntheticAuditPlanR6(), s)));
    expect(body).toContain("Anexo IV del PNT Nº GC-00/034/05");
    expect(body).toContain("Entidad Auditada: Proveedor ficticio");
    expect(body).toContain("Introducción ficticia");
    expect(body).toContain("Revisión");
    expect(body).not.toContain("XX:XX");
  });

  it("textos con «$&», «$'», «$`» y «$$» salen tal cual y el XML sigue bien formado", () => {
    const s = snapshot(false, signatories);
    const tricky = "Coste 5 US$&EUR, $' y $` y precio $$ doble <&>";
    (s.audit.findings[0] as { description: string }).description = tricky;
    const xml = docXml(generateAuditReport(syntheticAuditReportR6(), s, 0));
    expect(xml.match(/<w:document[\s>]/g)).toHaveLength(1);
    expect(xml).not.toContain("<?xml version=\"1.0\"?><w:document");
    expect(text(xml).replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")).toContain(`Deficiencia detectada: ${tricky}`);
  });

  it("sin observaciones ni recomendaciones: sin líneas de ejemplo ni la línea «RkXX»", () => {
    const s = snapshot(false, signatories);
    s.audit.findings = [];
    const body = text(docXml(generateAuditReport(syntheticAuditReportR6(), s, 0)));
    expect(body).not.toMatch(/OBS XX|RkXX|Evidencia objetiva|Ejemplo/);
    expect(body).toContain("HALLAZGOS DE LA AUDITORÍA");
  });

  it("los saltos de línea del requisito, la evidencia y la deficiencia se conservan", () => {
    const s = snapshot(false, signatories);
    Object.assign(s.audit.findings[0], { objectiveEvidence: "Registro A\nRegistro B" });
    const xml = docXml(generateAuditReport(syntheticAuditReportR6(), s, 0));
    const paragraphs = [...xml.matchAll(/<w:p>[\s\S]*?<\/w:p>/g)].map(m => text(m[0]));
    expect(paragraphs).toContain("Evidencia objetiva: Registro A");
    expect(paragraphs).toContain("Registro B");
  });

  it("conserva las filas del cuadro de firmas que haya después de las cuatro previstas", () => {
    const template = Buffer.from(syntheticAuditReportR6());
    const entries = readZip(template);
    const document = getZipEntryText(entries, "word/document.xml").replace("Recibido por Responsable/s del área auditada</w:t></w:r></w:p></w:tc>", "Recibido por Responsable/s del área auditada</w:t></w:r></w:p></w:tc>").replace(/(<w:tbl>(?:(?!<w:tbl>)[\s\S])*?Recibido por[\s\S]*?<\/w:tr>)(<\/w:tbl>)/, "$1<w:tr><w:tc><w:p><w:r><w:t>Fila adicional</w:t></w:r></w:p></w:tc></w:tr>$2");
    updateZipEntry(entries, "word/document.xml", document);
    const rows = cells(docXml(generateAuditReport(writeZip(entries), snapshot(false, signatories), 0)), 2);
    expect(rows.at(-1)?.[0]).toBe("Fila adicional");
  });
});

