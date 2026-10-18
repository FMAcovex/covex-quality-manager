import { describe, expect, it } from "vitest";
import { syntheticDocx } from "@/lib/ooxml/template-text";
import { writeZip } from "@/lib/ooxml/zip";
import { annexGeneratorView } from "@/modules/configuration/annex-generator-views";
import { templateCatalog } from "@/modules/configuration/template-catalog";
import { checkTemplateActivation, templateDifferences } from "@/modules/configuration/template-compatibility";

// D-100: plantillas sintéticas con etiquetas de ejemplo; las reales no se versionan.
const word = (cells: Record<string, string>, rows = 3, columns = 2) => syntheticDocx([{ rows, cells: columns, text: cells }]);
const v06 = word({ "0.0": "Disposición final:", "0.1": "☐ APROBADO Cantidad ____", "1.0": "Anexo III del PNT GC-00/023/06" });
const file = (versionCode: string, data: Buffer, fileName = "anexo.docx") => ({ versionCode, data, fileName });

const excel = (header: string, sheet = "AÑO") => writeZip([
  { name: "xl/workbook.xml", data: Buffer.from(`<workbook><sheets><sheet name="${sheet}" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
  { name: "xl/_rels/workbook.xml.rels", data: Buffer.from('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>') },
  { name: "xl/sharedStrings.xml", data: Buffer.from(`<sst><si><t>${header}</t></si><si><t>Revisión 06</t></si></sst>`) },
  { name: "xl/worksheets/sheet1.xml", data: Buffer.from('<worksheet><sheetData><row r="4"><c r="B4" t="s"><v>0</v></c><c r="C4" t="s"><v>1</v></c><c r="D4"/></row></sheetData></worksheet>') },
]);

describe("Comparación de una versión nueva con la activa", () => {
  it("las mismas etiquetas con otro código, revisión o fecha son compatibles", () => {
    const v07 = word({ "0.0": "Disposición final:", "0.1": "☐ APROBADO Cantidad ____", "1.0": "Anexo III del PNT GC-00/023/07" });
    expect(templateDifferences("DEVIATION_ANNEX_III", file("06", v06), file("07", v07))).toEqual([]);
  });

  it("detecta una etiqueta quitada, cambiada o añadida en su casilla", () => {
    const v07 = word({ "0.0": "Destino del producto:", "0.1": "☐ APROBADO ____", "1.0": "Anexo III del PNT GC-00/023/07", "2.1": "Lote de reanálisis:" });
    expect(templateDifferences("DEVIATION_ANNEX_III", file("06", v06), file("07", v07))).toEqual([
      "Tabla 1, fila 1, casilla 1: falta «Disposición final:»",
      "Tabla 1, fila 1, casilla 1: texto nuevo «Destino del producto:»",
      "Tabla 1, fila 1, casilla 2: falta «Cantidad»",
      "Tabla 1, fila 3, casilla 2: texto nuevo «Lote de reanálisis:»",
    ]);
  });

  it("detecta filas, casillas y tablas añadidas o quitadas", () => {
    const v07 = syntheticDocx([{ rows: 4, cells: 3, text: { "0.0": "Disposición final:", "0.1": "☐ APROBADO Cantidad ____", "1.0": "Anexo III del PNT" } }, { rows: 1, cells: 1 }]);
    expect(templateDifferences("DEVIATION_ANNEX_III", file("06", v06), file("07", v07))).toEqual([
      "Tiene 2 tablas; la versión 06 tenía 1.",
      "Tabla 1: 4 filas; antes 3.",
      "Tabla 1, fila 1: 3 casillas; antes 2.",
      "Tabla 1, fila 2: 3 casillas; antes 2.",
      "Tabla 1, fila 3: 3 casillas; antes 2.",
    ]);
  });

  it("compara las cabeceras y las hojas de los listados Excel", () => {
    expect(templateDifferences("DEVIATION_ANNEX_V", file("06", excel("Nº desviación"), "a.xlsx"), file("07", excel("Nº desviación"), "b.xlsx"))).toEqual([]);
    expect(templateDifferences("DEVIATION_ANNEX_V", file("06", excel("Nº desviación"), "a.xlsx"), file("07", excel("Código", "LISTADO"), "b.xlsx"))).toEqual([
      "Hojas: «LISTADO»; la versión 06 tenía «AÑO».",
      "Hoja «AÑO», celda B4: falta «Nº desviación»",
      "Hoja «AÑO», celda B4: texto nuevo «Código»",
    ]);
  });

  it("una versión que la aplicación rellena con otro mapeo no es compatible", () => {
    expect(annexGeneratorView("RETURN_ANNEX_IV", "03").mapping).not.toBe(annexGeneratorView("RETURN_ANNEX_IV", "04").mapping);
    expect(annexGeneratorView("COMPLAINT_ANNEX_IV", "03").mapping).not.toBe(annexGeneratorView("COMPLAINT_ANNEX_IV", "04").mapping);
    expect(templateDifferences("RETURN_ANNEX_IV", file("03", v06), file("04", v06))[0]).toMatch(/otro mapeo/);
  });

  it("si el anexo no está en el PNT o el archivo no es válido, no es compatible", () => {
    const pnt = word({ "0.0": "Anexo III del PNT" });
    expect(templateDifferences("COMPLAINT_ANNEX_III", file("02", pnt), file("04", word({ "0.0": "Otro documento" })))[0]).toMatch(/No se encuentra en el documento el anexo/);
    expect(templateDifferences("DEVIATION_ANNEX_III", file("06", v06), file("07", Buffer.from("no es un zip")))).toEqual(["El archivo no es un documento Word o Excel válido."]);
  });
});

describe("Activación de una versión nueva", () => {
  const base = { module: "DEVIATION" as const, documentType: "DEVIATION_ANNEX_III" as const };

  it("se permite si la aplicación ya conoce la versión (catálogo, misma huella)", () => {
    const entry = templateCatalog.find((item) => item.documentType === "DEVIATION_ANNEX_III")!;
    const sha = entry.sources[0].sha256;
    expect(checkTemplateActivation({ ...base, candidate: { ...file(entry.versionCode, v06), checksum: sha }, reference: file("05", word({})) })).toEqual({ status: "supported" });
    // Misma versión del catálogo con otro archivo: se compara como cualquier otra.
    expect(checkTemplateActivation({ ...base, candidate: { ...file(entry.versionCode, v06), checksum: "otra" }, reference: file("05", v06) }).status).toBe("compatible");
  });

  it("sin versión activa con archivo no hay con qué comparar", () => {
    expect(checkTemplateActivation({ ...base, candidate: { ...file("07", v06), checksum: "x" }, reference: null })).toEqual({ status: "first" });
  });

  it("se bloquea una versión incompatible y se permite una compatible", () => {
    const changed = word({ "0.0": "Destino:" });
    expect(checkTemplateActivation({ ...base, candidate: { ...file("07", changed), checksum: "x" }, reference: file("06", v06) }).status).toBe("incompatible");
    expect(checkTemplateActivation({ ...base, candidate: { ...file("07", v06), checksum: "x" }, reference: file("06", v06) })).toEqual({ status: "compatible", referenceVersion: "06" });
  });
});
