import { describe, expect, it, vi } from "vitest";
import { getZipEntryText, readZip, writeZip } from "@/lib/ooxml/zip";

// Listados anuales sobre un libro sintético con la fila modelo 5 (verificación del 18/10/2026, D-098).
const workbook = writeZip([
  { name: "xl/workbook.xml", data: Buffer.from('<workbook><sheets><sheet name="AÑO" sheetId="1" r:id="rId1"/></sheets><calcPr/></workbook>') },
  {
    name: "xl/worksheets/sheet1.xml",
    data: Buffer.from('<worksheet><dimension ref="A1:M5"/><sheetData><row r="2"><c r="A3"/><c r="B2"/></row><row r="4"><c r="B4"/></row><row r="5"><c r="B5" s="1"/></row></sheetData><mergeCells count="1"><mergeCell ref="B2:K2"/></mergeCells><pageMargins left="0.2"/><pageSetup orientation="landscape"/></worksheet>'),
  },
]);
vi.mock("@/modules/complaints/documents/templates", () => ({ loadComplaintPntTemplate: async () => workbook }));
vi.mock("@/modules/returns/documents/templates", () => ({ loadReturnPntTemplate: async () => workbook }));
// Anexo V de Desviaciones: libro sintético con la fila modelo 6, los estilos y la leyenda (fila 69).
const deviationWorkbook = writeZip([
  { name: "xl/workbook.xml", data: Buffer.from('<workbook><sheets><sheet name="AÑO" sheetId="1" r:id="rId1"/></sheets><calcPr/></workbook>') },
  { name: "xl/styles.xml", data: Buffer.from('<styleSheet><cellXfs count="9"><xf/><xf/><xf/><xf/><xf/><xf/><xf/><xf fillId="0" applyFill="0"/><xf fillId="0" applyFill="0"/></cellXfs></styleSheet>') },
  { name: "xl/worksheets/sheet1.xml", data: Buffer.from('<worksheet><dimension ref="A1:F71"/><sheetData><row r="2"><c r="B2"/></row><row r="5"><c r="A5"/></row><row r="6"><c r="A6" s="7"/><c r="F6" s="8"/></row><row r="69"><c r="A69"/></row></sheetData><mergeCells count="1"><mergeCell ref="B2:F2"/></mergeCells><pageMargins left="0.2"/><pageSetup orientation="landscape"/></worksheet>') },
]);
vi.mock("@/modules/deviations/documents/templates", () => ({ loadAnnexVTemplate: async () => deviationWorkbook }));
const { generateComplaintAnnexV } = await import("@/modules/complaints/documents/xlsx");
const { generateReturnAnnexVI } = await import("@/modules/returns/documents/xlsx");
const { generateAnnexV } = await import("@/modules/deviations/documents/xlsx");

const cell = (xlsx: Buffer, ref: string) =>
  getZipEntryText(readZip(xlsx), "xl/worksheets/sheet1.xml").match(new RegExp(`<c r="${ref}"[^>]*>(?:<is><t[^>]*>([^<]*)</t></is>)?`))?.[1] ?? "";

describe("Listados anuales", () => {
  it("Reclamaciones V (F4): los otros lotes afectados van en las columnas de producto y lote", async () => {
    const row = {
      qmsRecord: { businessCode: "R/GC/001/2096" }, complaintType: "CUSTOMER", openedAt: new Date("2096-02-10T00:00:00Z"), partyName: "Cliente ficticio",
      reference: "Producto A", affectedScope: null, lotReference: "L-1", additionalLots: [{ name: "Producto B", lot: "L-2" }],
      classification: "NO_GMP_IMPACT", status: "OPEN", closedAt: null, internalObservations: "Seguimiento interno", capaPlans: [], followups: [],
    };
    const xlsx = await generateComplaintAnnexV(2096, [row as never]);
    expect([cell(xlsx, "F5"), cell(xlsx, "G5")]).toEqual(["Producto A\nProducto B", "L-1\nL-2"]);
    expect(cell(xlsx, "K5")).toBe("Seguimiento interno");
  });

  it("Devoluciones VI (F6): «Trazabilidad» en español", async () => {
    const row = {
      qmsRecord: { businessCode: "DEV/LG-001/2096" }, communicationDate: null, relatedDocument: "Albarán", returnType: "COMMERCIAL", customerEntity: "Cliente",
      country: null, destructionManagedBy: null, destructionCertificate: null, finalDestination: null, traceabilityUpdated: "YES", internalObservations: "Nota interna",
      products: [{ productNameCode: "Producto", format: null, lot: "L-1", quantity: "1", unit: "ud", expiryReanalysis: null }], followups: [],
    };
    expect(cell(await generateReturnAnnexVI(2096, [row as never]), "M5")).toBe("Trazabilidad: Sí · Nota interna");
  });
});

// Un «$» del usuario no debe interpretarse como patrón de String.replace: «"50$"» acaba en «$&» tras el escape XML.
const TRICKY = 'Coste "50$" por lote, A $$ B, $& y fin';
const TRICKY_XML = "Coste &quot;50$&quot; por lote, A $$ B, $&amp; y fin";
const sheetOf = (xlsx: Buffer) => getZipEntryText(readZip(xlsx), "xl/worksheets/sheet1.xml");
describe("Listados anuales con «$» en los textos", () => {
  it("Reclamaciones V", async () => {
    const row = { qmsRecord: { businessCode: "R/1" }, complaintType: "CUSTOMER", openedAt: new Date("2096-02-10T00:00:00Z"), partyName: TRICKY, reference: "P", affectedScope: null, lotReference: "L", additionalLots: [], classification: "NO_GMP_IMPACT", status: "OPEN", closedAt: null, internalObservations: TRICKY, capaPlans: [], followups: [] };
    const sheet = sheetOf(await generateComplaintAnnexV(2096, [row as never]));
    expect(sheet.match(/<sheetData>/g)).toHaveLength(1);
    expect(sheet).toContain(TRICKY_XML);
  });
  it("Devoluciones VI", async () => {
    const row = { qmsRecord: { businessCode: "DEV/1" }, communicationDate: null, relatedDocument: TRICKY, returnType: "COMMERCIAL", customerEntity: TRICKY, country: null, destructionManagedBy: null, destructionCertificate: null, finalDestination: null, traceabilityUpdated: "YES", internalObservations: null, products: [{ productNameCode: "P", format: null, lot: "L", quantity: "1", unit: "ud", expiryReanalysis: null }], followups: [] };
    const sheet = sheetOf(await generateReturnAnnexVI(2096, [row as never]));
    expect(sheet.match(/<sheetData>/g)).toHaveLength(1);
    expect(sheet).toContain(TRICKY_XML);
  });
  it("Desviaciones V", async () => {
    const row = { qmsRecord: { businessCode: "D/GC/001/2096", year: 2096 }, departmentCodeSnapshot: "GC", departmentNameSnapshot: null, materialProcessAffected: "x", provenance: null, whatHappened: TRICKY, classification: null, rootCause: null, issueDate: null, closedAt: null, status: "OPEN", deadlineDate: null, capaPlans: [], extraData: null };
    const sheet = sheetOf(await generateAnnexV(2096, [row as never]));
    expect(sheet.match(/<sheetData>/g)).toHaveLength(1);
    expect(sheet).toContain(TRICKY_XML);
  });
});

