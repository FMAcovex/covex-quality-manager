import { describe, expect, it, vi } from "vitest";
import { documentCellTexts, missingTemplateWords } from "@/lib/ooxml/template-text";

vi.mock("@/modules/deviations/documents/templates", () => ({ loadAnnexIIITemplate: async () => Buffer.alloc(0) }));
const { fillDispositionCell, setImpactCell } = await import("@/modules/deviations/documents/annex-iii");

// Casillas y textos literales del Anexo III v06 (bloques de impacto y disposición final).
const box = `<w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:t>☐</w:t></w:r></w:sdtContent></w:sdt>`;
const run = (text: string) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const tab = "<w:r><w:tab/></w:r>";
const p = (...parts: string[]) => `<w:p>${parts.join("")}</w:p>`;
const cell = (...paragraphs: string[]) => `<w:tc><w:tcPr/>${paragraphs.join("") || "<w:p/>"}</w:tc>`;
const table = (rows: string[][]) => `<w:tbl>${rows.map((cells) => `<w:tr>${cells.join("")}</w:tr>`).join("")}</w:tbl>`;
const empty = (rows: number) => table(Array.from({ length: rows }, () => [cell()]));

const impact = (label: string, middle = "") => cell(p(run(`${label} SI `), box, run(`${middle} NO `), box, run(" NA "), box));
const dispositionCell = cell(
  p(box, run(" APROBADO"), tab, tab, tab, run("Cantidad _____________")),
  p(),
  p(box, run(" RECHAZADO"), tab, tab, box, run(" Destruir"), tab, tab, run("Cantidad _______")),
  p(tab, tab, tab, tab, box, run(" Devolver"), tab, tab, run("Cantidad _______")),
  p(box, run("  OTRO")),
  p(run("(Añadir cualquier comentario adicional sobre la decisión de disposición)")),
);
const documentXml = [
  empty(1),
  empty(1),
  empty(1),
  table([...Array.from({ length: 6 }, () => [cell()]), [impact("Impacto sobre el status de estabilidad"), impact("Impacto sobre otros procesos/productos", " (detallar cuales):")]]),
  table([[cell()], [cell()], [cell()], [dispositionCell]]),
].join("<w:p/>");
const templateTexts = documentCellTexts(documentXml);

describe("Desviaciones Anexo III: impacto y disposición final", () => {
  it("F2: marca la casilla y añade el detalle sin perder «(detallar cuales):»", () => {
    const xml = setImpactCell(documentXml, 6, 1, "YES", "Producto ficticio B");
    const output = documentCellTexts(xml)[3][6][1];
    expect(missingTemplateWords(templateTexts[3][6][1], output)).toEqual([]);
    expect(output).toBe("Impacto sobre otros procesos/productos SI ☒ (detallar cuales): NO ☐ NA ☐\nProducto ficticio B");
  });

  it.each([
    ["Aprobado", "☒ APROBADO\t\t\tCantidad 25 kg", ["☐ RECHAZADO\t\t☐ Destruir\t\tCantidad _______", "\t\t\t\t☐ Devolver\t\tCantidad _______", "☐  OTRO"]],
    ["Rechazado – Destruir", "☐ APROBADO\t\t\tCantidad _____________", ["☒ RECHAZADO\t\t☒ Destruir\t\tCantidad 25 kg", "\t\t\t\t☐ Devolver\t\tCantidad _______", "☐  OTRO"]],
    ["Rechazado – Devolver", "☐ APROBADO\t\t\tCantidad _____________", ["☒ RECHAZADO\t\t☐ Destruir\t\tCantidad _______", "\t\t\t\t☒ Devolver\t\tCantidad 25 kg", "☐  OTRO"]],
  ])("D1: «%s» marca su casilla y escribe la cantidad en su línea", (disposition, first, rest) => {
    const output = documentCellTexts(fillDispositionCell(documentXml, { disposition, dispositionQuantity: "25 kg", dispositionComments: null }))[4][3][0];
    expect(missingTemplateWords(templateTexts[4][3][0], output)).toEqual([]);
    expect(output.split("\n")).toEqual([first, "", ...rest, "(Añadir cualquier comentario adicional sobre la decisión de disposición)"]);
  });

  it("D1: un texto anterior no estándar se muestra como «Otro» y se conserva literal", () => {
    const output = documentCellTexts(fillDispositionCell(documentXml, { disposition: "Reprocesar según PNT", dispositionQuantity: "3 uds", dispositionComments: "Comentario" }))[4][3][0];
    expect(output.split("\n").slice(2)).toEqual([
      "☐ RECHAZADO\t\t☐ Destruir\t\tCantidad _______",
      "\t\t\t\t☐ Devolver\t\tCantidad _______",
      "☒  OTRO",
      "(Añadir cualquier comentario adicional sobre la decisión de disposición)",
      "Cantidad: 3 uds",
      "Reprocesar según PNT",
      "Comentario",
    ]);
  });
});
