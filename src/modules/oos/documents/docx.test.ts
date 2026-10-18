import { describe, expect, it } from "vitest";
import { getZipEntryText, readZip, writeZip } from "@/lib/ooxml/zip";
import { deriveOosAnnex } from "@/modules/oos/documents/derive";
import { completeFormPageCount, fillOosAnnexIII, fillOosAnnexIV, fillOosAnnexVI, oosInvestigationSummary, oosListingShades, type OosDocumentRecord } from "@/modules/oos/documents/docx";

// Synthetic grids with the table/row/cell counts of PNT GC-10/014/04 (D-088, OOS-3).
function template(tables: [rows: number, cells: number][], firstCell = "") {
  const table = ([rows, cells]: [number, number], index: number) => `<w:tbl>${Array.from({ length: rows }, (_, row) => `<w:tr>${Array.from({ length: cells }, (_, cell) => `<w:tc><w:tcPr/><w:p>${index === 0 && row === 1 && cell === 1 && firstCell ? `<w:r><w:t>${firstCell}</w:t></w:r>` : ""}</w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
  return writeZip([{ name: "word/document.xml", data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${tables.map(table).join("<w:p/>")}<w:sectPr/></w:body></w:document>`) }]);
}
function cells(output: Buffer) {
  const xml = getZipEntryText(readZip(output), "word/document.xml");
  return [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map((table) => [...table[1].matchAll(/<w:tr>([\s\S]*?)<\/w:tr>/g)].map((row) =>
    [...row[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((cell) => ({ text: [...cell[1].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("|").trim(), xml: cell[1] }))));
}

const d = (value: string) => new Date(`${value}T00:00:00Z`);
const record: OosDocumentRecord = {
  status: "CLOSED", issueDate: d("2096-03-10"), materialKind: "RAW_OR_PACKAGING_MATERIAL", materialName: "Materia ficticia", lotNumber: "L-1", batchSize: "10 kg", affectedQuantity: "5 kg",
  supplier: "Proveedor ficticio", supplierLot: "PV-1", process: "Recepción", oosDate: d("2096-03-09"), oosTime: "10:30", detectedBy: "Analista", shift: "Mañana", detectionDescription: "Descripción ficticia",
  phaseIEvaluation: { analystTraining: "Conforme", microNegativeControl: "No aplica" }, phaseIInvestigation: "Investigación", phaseIConclusion: "Conclusión", phaseIDisposition: "FULL_SCALE",
  phaseIVerdict: "OTHER", phaseIVerdictQuantity: "2 kg", phaseIDestroyQuantity: null, phaseIReturnQuantity: null, phaseIVerdictOther: "Cuarentena",
  phaseIIssuedBy: "Jefe CC", phaseIIssuedAt: d("2096-03-11"), phaseIApprovedBy: "Director GC", phaseIApprovedAt: d("2096-03-12"),
  phaseIIIssueDate: d("2096-03-13"), phaseIIProductionReview: "Revisión", phaseIIRetesting: "Repetición", phaseIIResampling: "Remuestreo", phaseIIConclusion: "Conclusión II",
  phaseIIVerdict: "REJECTED", phaseIIVerdictQuantity: "5 kg", phaseIIDestroyQuantity: "3 kg", phaseIIReturnQuantity: "2 kg", phaseIIVerdictOther: null,
  phaseIIIssuedBy: "Director GC", phaseIIIssuedAt: d("2096-03-20"), phaseIIAffectedDepartments: "Producción", investigationResult: "INCONCLUSIVE", closedAt: d("2096-03-20"),
  qmsRecord: { businessCode: "OOS/MD/001/2096", sourceRelations: [{ targetRecord: { recordType: "CAPA", businessCode: "CA-1", annulledBusinessCode: null } }] },
};

describe("Anexos OOS del PNT GC-10/014/04", () => {
  it("Anexo III: datos iniciales, los 21 parámetros en orden, disposición y dictamen «otros»", () => {
    const [page1, page2, page3] = cells(fillOosAnnexIII(template([[15, 6], [25, 3], [18, 6]]), record));
    expect([page1[1][0].text, page1[1][1].text]).toEqual(["OOS/MD/001/2096", "10/03/2096"]);
    expect(page1[3][1].text).toBe(""); // bloque de producto final vacío para materia prima
    expect([page1[6][1].text, page1[6][3].text, page1[7][3].text, page1[8][3].text, page1[9][1].text, page1[9][3].text]).toEqual(["Materia ficticia", "L-1", "10 kg", "5 kg", "Proveedor ficticio", "PV-1"]);
    expect([page1[11][1].text, page1[11][2].text, page1[11][4].text, page1[11][5].text, page1[13][0].text]).toEqual(["09/03/2096", "10:30", "Analista", "Mañana", "Descripción ficticia"]);
    expect([page2[3][2].text, page2[4][2].text, page2[23][2].text]).toEqual(["Conforme", "", "No aplica"]);
    expect([page3[2][0].text, page3[4][0].text, page3[6][1].text, page3[7][1].text]).toEqual(["Investigación", "Conclusión", "", "X"]);
    expect([page3[9][1].text, page3[9][5].text, page3[10][1].text, page3[10][5].text]).toEqual(["", "X", "", "Cuarentena|Cantidad: 2 kg"]);
    expect([page3[13][0].text, page3[13][2].text, page3[14][0].text, page3[14][2].text]).toEqual(["Jefe CC", "11/03/2096", "Director GC", "12/03/2096"]);
  });

  it("Anexo IV: revisión, pruebas, conclusión, dictamen rechazado con destino y departamentos", () => {
    const [page1, page2] = cells(fillOosAnnexIV(template([[9, 2], [13, 6]]), record));
    expect([page1[1][0].text, page1[1][1].text, page1[3][0].text, page1[5][0].text, page1[7][0].text]).toEqual(["OOS/MD/001/2096", "13/03/2096", "Revisión", "Repetición", "Remuestreo"]);
    expect([page2[2][0].text, page2[4][3].text, page2[5][1].text, page2[5][3].text, page2[6][3].text, page2[7][3].text]).toEqual(["Conclusión II", "X", "", "3 kg", "2 kg", "5 kg"]);
    expect([page2[8][0].text, page2[8][2].text, page2[9][0].text]).toEqual(["Director GC", "20/03/2096", "Producción"]);
  });

  it("Anexo VI: año, una fila por OOS con su estado en color y filas en blanco conservadas", () => {
    const open = { ...record, status: "OPEN" as const, investigationResult: null, closedAt: null, phaseIDisposition: null, qmsRecord: { businessCode: "OOS/API/001/2096", sourceRelations: [] } };
    const [listing] = cells(fillOosAnnexVI(template([[17, 6]], "AÑO:_"), 2096, [record, open]));
    // D-103: el año va en su propio run con Arial 11.
    expect(listing[1][1].text).toBe("AÑO:| 2096");
    expect(listing[1][1].xml).toMatch(/<w:sz w:val="22"\/><w:szCs w:val="22"\/><\/w:rPr><w:t xml:space="preserve"> 2096<\/w:t>/);
    expect(listing[4].map((cell) => cell.text)).toEqual(["OOS/MD/001/2096", "10/03/2096", "Materia ficticia|Lote L-1", "Descripción ficticia", "No concluyente|CAPA CA-1", "20/03/2096"]);
    expect(listing[4].every((cell) => cell.xml.includes(`w:fill="${oosListingShades.closed}"`))).toBe(true);
    expect(listing[5][4].text).toBe("En curso · Fase I");
    expect(listing[5][0].xml).toContain(`w:fill="${oosListingShades.pending}"`);
    expect(listing).toHaveLength(17);
    expect(listing[6].map((cell) => cell.text)).toEqual(["", "", "", "", "", ""]);
  });

  it("resume investigación y expedientes derivados sin inventar resultado en borrador", () => {
    expect(oosInvestigationSummary({ ...record, status: "DRAFT", investigationResult: null, qmsRecord: { businessCode: null, sourceRelations: [] } })).toBe("");
  });
});

describe("derivación de los anexos desde el PNT", () => {
  it("toma cada anexo desde el título de su formulario hasta el siguiente, sin títulos, encabezado ni pie del PNT", () => {
    const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
    const section = '<w:p><w:pPr><w:sectPr><w:headerReference w:type="default" r:id="rId12"/><w:footerReference w:type="default" r:id="rId13"/></w:sectPr></w:pPr></w:p>';
    const body = [p("8. ANEXOS"), p("An"), p("Anexo II"), p("Anexo III"), p("Fase I"), p("Anexo III del PNT GC-10/014/04"), section, p("Anexo IV"), p("Fase II"), p("Anexo IV del PNT GC-10/014/04"), p("ANEXO V"), p("Árbol"), p("ANEXO VI"), p("LISTADO GENERAL DE OOS"), p("LISTADO GENERAL DE OOS AÑO:_")].join("");
    const pnt = writeZip([{ name: "word/document.xml", data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`) }]);
    const text = (type: Parameters<typeof deriveOosAnnex>[1]) => [...getZipEntryText(readZip(deriveOosAnnex(pnt, type)), "word/document.xml").matchAll(/<w:t>([^<]*)<\/w:t>/g)].map((m) => m[1]);
    expect(text("OOS_ANNEX_III")).toEqual(["Anexo III del PNT GC-10/014/04"]);
    expect(text("OOS_ANNEX_IV")).toEqual(["Anexo IV del PNT GC-10/014/04"]);
    expect(text("OOS_ANNEX_VI")).toEqual(["LISTADO GENERAL DE OOS AÑO:_"]);
    // Sin encabezado ni pie del PNT: la única numeración es la del propio formulario.
    expect(getZipEntryText(readZip(deriveOosAnnex(pnt, "OOS_ANNEX_III")), "word/document.xml")).not.toMatch(/headerReference|footerReference/);
  });
});

describe("numeración del formulario", () => {
  it("sustituye la X de «Página n de X» por el número de páginas del anexo, también con la X en otro run", () => {
    const xml = '<w:t xml:space="preserve">Página 1 de </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>X</w:t><w:t>Página 2 de X</w:t><w:t>X</w:t>';
    expect(completeFormPageCount(xml)).toBe('<w:t xml:space="preserve">Página 1 de </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>2</w:t><w:t>Página 2 de 2</w:t><w:t>X</w:t>');
    expect(completeFormPageCount("<w:t>Sin numeración X</w:t>")).toBe("<w:t>Sin numeración X</w:t>");
  });
});
