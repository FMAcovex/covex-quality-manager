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
const { generateComplaintAnnexV } = await import("@/modules/complaints/documents/xlsx");
const { generateReturnAnnexVI } = await import("@/modules/returns/documents/xlsx");

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
