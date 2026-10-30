import { describe, expect, it, vi } from "vitest";
import { documentCellTexts, missingTemplateWords } from "@/lib/ooxml/template-text";

vi.mock("@/modules/deviations/documents/templates", () => ({ loadAnnexIIITemplate: async () => Buffer.alloc(0) }));
const { fillDispositionCell, fillEventRow, fillRootCauseCell, fillTextTables, setImpactCell } = await import("@/modules/deviations/documents/annex-iii");

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

describe("Desviaciones Anexo III: fecha, hora y turno del evento (D-116)", () => {
  // Fila 5 de la tabla 0 del Anexo III v06: «fecha», «hora», dos celdas vacías y «turno».
  const hint = (text: string) => cell(p(run(text)));
  const eventXml = table([...Array.from({ length: 5 }, () => [cell()]), [cell(), hint("fecha"), hint("hora"), cell(), cell(), hint("turno")]]);

  it("escribe el turno en la casilla «turno» y quita la indicación", () => {
    const xml = fillEventRow(eventXml, { eventDateTime: new Date(2026, 9, 20, 7, 30), shift: "Mañana" });
    const texts = documentCellTexts(xml)[0][5];
    expect(texts[5]).toBe("Mañana");
    expect(texts[1]).toBe("20/10/2026");
    expect(texts[2]).toBe("07:30");
  });

  it("sin turno, la casilla queda vacía como la fecha y la hora", () => {
    const texts = documentCellTexts(fillEventRow(eventXml, { eventDateTime: null, shift: null }))[0][5];
    expect(texts.slice(1, 3)).toEqual(["", ""]);
    expect(texts[5]).toBe("");
  });
});

describe("Desviaciones Anexo III: casilla de causa raíz con el análisis (D-124)", () => {
  // Tabla 2 del Anexo III v06: la causa raíz va en la fila 14, celda 0.
  const rootXml = [empty(1), empty(1), table(Array.from({ length: 15 }, () => [cell()]))].join("<w:p/>");
  const investigationTools = {
    fiveWhys: { problem: "Tres días sin firma", whys: ["Supervisor de vacaciones", "Sin suplente en el formato"], status: "CONFIRMED" },
    causes: [{ method: "ISHIKAWA", category: "PEOPLE", text: "Puerta mal cerrada", evidence: "Sin aperturas", status: "DISCARDED" }],
    fta: null,
  };

  it("escribe la causa raíz y, debajo, todas las herramientas usadas, cada línea en su párrafo", () => {
    const xml = fillRootCauseCell(rootXml, { rootCause: "Formato sin suplente.", investigationTools });
    expect(documentCellTexts(xml)[2][14][0].split("\n")).toEqual([
      "Formato sin suplente.", "",
      "Análisis — 5 porqués (confirmada)", "Problema: Tres días sin firma", "1. ¿Por qué? Supervisor de vacaciones", "2. ¿Por qué? Sin suplente en el formato", "",
      "Análisis — Ishikawa (6M)", "Mano de obra: Puerta mal cerrada (descartada; evidencia: Sin aperturas)",
    ]);
  });

  it("sin herramientas (o con un valor ilegible) queda solo la causa raíz, como antes", () => {
    expect(documentCellTexts(fillRootCauseCell(rootXml, { rootCause: "Causa", investigationTools: null }))[2][14][0]).toBe("Causa");
    expect(documentCellTexts(fillRootCauseCell(rootXml, { rootCause: "Causa", investigationTools: { causes: "x" } }))[2][14][0]).toBe("Causa");
  });
});

describe("Desviaciones Anexo III: tablas de los textos dentro de su casilla (D-127)", () => {
  const table = (title: string) => ({ title, columns: ["Lote", "Estado"], rows: [["L-1", "Retenido"]] });
  it("cada tabla va al final de la casilla de su apartado, numerada en el orden del expediente", () => {
    const xml = fillTextTables(documentXml, { textTables: { dispositionComments: [table("Destino")], otherProcessesImpactDetails: [table("Productos"), table("Procesos")] }, immediateActions: [], capaPlans: [] });
    // La casilla conserva todo su contenido de la plantilla y la tabla va justo después.
    const caption = '<w:p><w:pPr><w:keepNext/>';
    const impactCell = impact("Impacto sobre otros procesos/productos", " (detallar cuales):");
    expect(xml).toContain(impactCell.slice(0, -"</w:tc>".length) + caption);
    expect(xml).toContain(dispositionCell.slice(0, -"</w:tc>".length) + caption);
    const order = ["Tabla 1. Productos", "Tabla 2. Procesos", "Tabla 3. Destino"].map((text) => xml.indexOf(text));
    expect(order.every((position, index) => position > 0 && (index === 0 || position > order[index - 1]))).toBe(true);
  });

  it("con varias acciones inmediatas o CAPA, la tabla sigue yendo a su casilla (filas copiadas de la plantilla)", async () => {
    const { replaceWordRowWithCopies } = await import("@/lib/ooxml/xml");
    const marked = (tableIndex: number, rows: number) => `<w:tbl>${Array.from({ length: rows }, (_, row) => `<w:tr>${[0, 1].map((at) => cell(p(run(`T${tableIndex}R${row}C${at}`)))).join("")}</w:tr>`).join("")}</w:tbl>`;
    let xml = [marked(0, 1), marked(1, 1), marked(2, 17), marked(3, 13), marked(4, 4)].join("<w:p/>");
    const actions = [{ description: "a" }, { description: "b" }, { description: "c" }];
    const capas = [{ actionType: "CORRECTIVE" }, { actionType: "PREVENTIVE" }];
    xml = replaceWordRowWithCopies(xml, 2, 3, actions.map((action) => [action.description]));
    xml = replaceWordRowWithCopies(xml, 3, 12, capas.map((capa) => [capa.actionType]));
    const out = fillTextTables(xml, {
      textTables: { investigation: [table("Lotes")], rootCause: [table("Causas")], otherProcessesImpactDetails: [table("Otros")] },
      immediateActions: actions as never, capaPlans: capas as never,
    });
    const after = (marker: string, caption: string) => out.indexOf(caption) > out.indexOf(marker) && out.slice(out.indexOf(marker), out.indexOf(caption)).match(/<\/w:tc>/g) === null;
    expect(after("T2R6C0", "Tabla 1. Lotes")).toBe(true);
    expect(after("T2R14C0", "Tabla 2. Causas")).toBe(true);
    expect(after("T3R6C1", "Tabla 3. Otros")).toBe(true);
  });

  it("sin tablas, o con un valor ilegible, el documento no cambia", () => {
    expect(fillTextTables(documentXml, { textTables: null, immediateActions: [], capaPlans: [] })).toBe(documentXml);
    expect(fillTextTables(documentXml, { textTables: { investigation: "x" }, immediateActions: [], capaPlans: [] })).toBe(documentXml);
  });
});

