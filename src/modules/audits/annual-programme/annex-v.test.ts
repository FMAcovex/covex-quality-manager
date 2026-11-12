import { describe, expect, it } from "vitest";
import { syntheticAnnexVProgramme, syntheticAnnualProgramme, syntheticProgrammeContent } from "../../../../scripts/audits-annual-programme-fixtures";
import { generateAnnualProgramme, isAnnexVProgramme } from "./generator";
import { getZipEntryText, readZip } from "@/lib/ooxml/zip";
import { orderProgrammeAreas, programmeChanges, programmeComments, programmeReference, programmeTemplateFormat } from "./domain";

// D-135 (R6): Programa Anual de Auditorías como Anexo V de los PNT GC-00/033/04 y GC-00/034/05. Datos ficticios.
const docXml = (bytes: Buffer) => getZipEntryText(readZip(bytes), "word/document.xml");
const text = (xml: string) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join("");
function cells(xml: string, table: number) {
  const tbl = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)][table][0];
  return [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(r => [...r[0].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map(c => text(c[0]).trim()));
}
function content(internal: boolean) {
  const c = syntheticProgrammeContent(internal, 3, "ANNEX_V");
  Object.assign(c.rows[0], { code: "AI/GC-00/01/2097", performed: "10/03/2097", partial: "02/04/2097", comments: "Aplazada (prevista inicialmente: 01/02/2097). Motivo: ficticio" });
  return c;
}

describe("D-135 · Anexo V del programa anual", () => {
  it("reconoce el formato por la plantilla y deduce su referencia", () => {
    expect(isAnnexVProgramme(docXml(syntheticAnnexVProgramme(true)))).toBe(true);
    expect(isAnnexVProgramme(docXml(syntheticAnnualProgramme(true)))).toBe(false);
    expect(programmeTemplateFormat("GC-00-033-04-ANEXO-V")).toBe("ANNEX_V");
    expect(programmeTemplateFormat("PMAI-V04-01-2023-GENERAL")).toBe("MASTER_PLAN");
    expect(programmeTemplateFormat(null)).toBe("MASTER_PLAN");
    expect(programmeReference("EXTERNAL", "GC-00-034-05-ANEXO-V")).toBe("Anexo V del PNT GC-00/034/05");
    expect(programmeReference("INTERNAL", "PMAI-V04-01-2023-GENERAL")).toBe("Anexo/PMAI/V04/01-2023");
  });

  it("interno: año y versión, una fila por auditoría con área y alcance, código, fechas y comentarios", () => {
    const xml = docXml(generateAnnualProgramme(syntheticAnnexVProgramme(true), content(true), 2));
    expect(cells(xml, 1)[0]).toEqual(["Año:", "2027", "Versión:", "02"]);
    const rows = cells(xml, 2);
    expect(rows).toHaveLength(5);
    expect(rows[1][1]).toBe("Área y alcance");
    expect(rows[2]).toEqual(["1", "Entidad ficticia 1 &amp; departamentoAlcance", "Primer trimestre", "Auditor ficticio", "AI/GC-00/01/2097", "10/03/2097", "02/04/2097", "Aplazada (prevista inicialmente: 01/02/2097). Motivo: ficticio"]);
    expect(rows.slice(2).map(r => r[0])).toEqual(["1", "2", "3"]);
    // Las dos filas de cabecera se repiten en cada página; las de datos no.
    const trs = [...[...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)][2][0].matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(m => m[0]);
    expect(trs.map(r => r.includes("<w:tblHeader/>"))).toEqual([true, true, false, false, false]);
    expect(cells(xml, 3).map(r => r.slice(0, 2))).toEqual([["Función", "Nombre y apellido"], ["Elaborado por Garantía de Calidad", "Elaboradora ficticia"], ["Aprobado por Dirección de Garantía de Calidad", "Aprobador calidad ficticio"]]);
    expect(text(xml)).not.toContain("Añadir o eliminar tantas filas");
    expect(text(xml)).not.toContain("Aprobador técnico ficticio");
    // Revisión I-2: la instrucción se vacía, no se borra: dos tablas seguidas se fundirían en Word.
    expect(xml).not.toMatch(/<\/w:tbl>\s*<w:tbl>/);
  });

  it("externo: banda AMBITO por ámbito, entidad con producto y alcance, numeración continua", () => {
    const xml = docXml(generateAnnualProgramme(syntheticAnnexVProgramme(false), content(false), 0));
    expect(cells(xml, 1)[0]).toEqual(["Año:", "2027", "Versión:", "00"]);
    const rows = cells(xml, 2);
    expect(rows.map(r => r[0])).toEqual(["PLANIFICACIÓN", "Nº", "AMBITO Calidad", "1", "2", "AMBITO Servicios", "3"]);
    expect(rows[3][1]).toBe("Entidad ficticia 1 &amp; departamentoServicioAlcance");
    // Ninguna banda generada se repite como cabecera.
    const trs = [...[...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)][2][0].matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)].map(m => m[0]);
    expect(trs.slice(2).some(r => r.includes("<w:tblHeader/>"))).toBe(false);
    expect(text(xml)).not.toContain("AMBITO_");
  });

  it("conserva cabecera, estilos y recursos de la plantilla y limpia los metadatos", () => {
    const source = syntheticAnnexVProgramme(true), out = readZip(generateAnnualProgramme(source, content(true), 0));
    for (const name of ["word/styles.xml", "word/header1.xml", "word/footer1.xml"]) expect(getZipEntryText(out, name)).toBe(getZipEntryText(readZip(source), name));
    expect(getZipEntryText(out, "docProps/core.xml")).not.toContain("Autor plantilla");
  });

  it("rechaza una plantilla cuyo formato no coincide con el decidido por su versión (revisión M-4)", () => {
    expect(() => generateAnnualProgramme(syntheticAnnexVProgramme(true), syntheticProgrammeContent(true, 1, "MASTER_PLAN"), 0)).toThrow(/formato/);
    expect(() => generateAnnualProgramme(syntheticAnnualProgramme(true), syntheticProgrammeContent(true, 1, "ANNEX_V"), 0)).toThrow(/formato/);
  });
  it("rechaza un Anexo V de otro tipo de programa", () => {
    expect(() => generateAnnualProgramme(syntheticAnnexVProgramme(false), content(true), 0)).toThrow(/no corresponde/);
  });

  it("la plantilla anterior no incorpora las entradas canceladas", () => {
    const c = syntheticProgrammeContent(true, 2); c.rows[1].cancelled = true;
    expect(text(docXml(generateAnnualProgramme(syntheticAnnualProgramme(true), c)))).not.toContain("Entidad ficticia 2");
  });
});

describe("D-135 · comentarios y cambios del programa", () => {
  it("comentarios: cancelada o aplazada con motivo, modalidad en externas y observaciones", () => {
    const base = { external: true, notes: "Nota", modality: "Remota", planned: "15/05/2097" };
    expect(programmeComments(base)).toBe("Modalidad prevista: Remota\nNota");
    expect(programmeComments({ ...base, external: false })).toBe("Nota");
    expect(programmeComments({ ...base, initialPlanned: "15/03/2097", rescheduleReason: "Falta de personal" })).toBe("Aplazada (prevista inicialmente: 15/03/2097). Motivo: Falta de personal\nModalidad prevista: Remota\nNota");
    expect(programmeComments({ ...base, initialPlanned: "15/06/2097" })).toBe("Adelantada (prevista inicialmente: 15/06/2097).\nModalidad prevista: Remota\nNota");
    // Revisión I-3: si las fechas no se pueden comparar (un período), no se afirma que se haya aplazado.
    expect(programmeComments({ ...base, initialPlanned: "Primer trimestre", rescheduleReason: "Fecha concretada" })).toBe("Reprogramada (prevista inicialmente: Primer trimestre). Motivo: Fecha concretada\nModalidad prevista: Remota\nNota");
    expect(programmeComments({ ...base, initialPlanned: "15/05/2097" })).toBe("Modalidad prevista: Remota\nNota");
    expect(programmeComments({ ...base, cancelledReason: "Proveedor dado de baja", initialPlanned: "01/01/2097" })).toBe("Cancelada. Motivo: Proveedor dado de baja\nModalidad prevista: Remota\nNota");
    expect(programmeComments({ ...base, cancelledReason: "" })).toMatch(/^Cancelada\.\n/);
  });

  it("cambios respecto a la última versión emitida", () => {
    const before = syntheticProgrammeContent(true, 2, "ANNEX_V"), after = syntheticProgrammeContent(true, 3, "ANNEX_V");
    Object.assign(after.rows[0], { code: "AI/GC-00/01/2097", performed: "10/03/2097" });
    after.rows[1].cancelled = true;
    after.preparedByName = "Otra persona";
    expect(programmeChanges(before, after)).toEqual([
      "Entidad ficticia 1 & departamento: código de auditoría vacío → «AI/GC-00/01/2097».",
      "Entidad ficticia 1 & departamento: fecha de auditoría vacío → «10/03/2097».",
      "Cancelada: Entidad ficticia 2 & departamento.",
      "Nueva auditoría: Entidad ficticia 3 & departamento.",
      "Elaborado por: «Elaboradora ficticia» → «Otra persona».",
    ]);
    expect(programmeChanges(null, after)).toEqual([]);
    // Las emisiones anteriores a D-135 no tienen código ni comentarios: no se inventan cambios de comentarios vacíos.
    const legacy = { rows: [{ ...before.rows[0], code: undefined, comments: undefined }] } as never;
    expect(programmeChanges(legacy, { ...before, rows: [before.rows[0]] }).some(c => /código|comentarios/.test(c))).toBe(false);
  });
});

describe("D-135 · orden de los ámbitos del programa externo", () => {
  it("Medicamento primero, después API y el resto en su orden; las entradas de un ámbito quedan juntas", () => {
    const rows = ["Servicios", "API", "medicamentos", "", "APIs", "Medicamento", "Excipientes"].map((area, i) => ({ id: i, area }));
    expect(orderProgrammeAreas(rows).map(r => r.id)).toEqual([2, 5, 1, 4, 0, 3, 6]);
  });
  it("revisión I-2: solo Medicamento y API exactos (y sus plurales) van delante", () => {
    const rows = ["Medicamentos veterinarios", "Apicultura", "Principios activos (API)", "API", "Medicamento"].map((area, i) => ({ id: i, area }));
    expect(orderProgrammeAreas(rows).map(r => r.id)).toEqual([4, 3, 0, 1, 2]);
  });
  it("revisión I-1: el mismo ámbito escrito de otra forma es una sola banda, con su primera forma", () => {
    const rows = ["MEDICAMENTO", "Servicios", "Medicamento", " medicaménto ", "api", "API"].map((area, i) => ({ id: i, area }));
    expect(orderProgrammeAreas(rows).map(r => [r.id, r.area])).toEqual([[0, "MEDICAMENTO"], [2, "MEDICAMENTO"], [3, "MEDICAMENTO"], [4, "api"], [5, "api"], [1, "Servicios"]]);
  });
  it("el Word sigue el mismo orden que la vista previa", () => {
    const c = content(false);
    c.rows = orderProgrammeAreas([{ ...c.rows[0], area: "Servicios" }, { ...c.rows[1], area: "API" }, { ...c.rows[2], area: "api" }]);
    const rows = cells(docXml(generateAnnualProgramme(syntheticAnnexVProgramme(false), c, 0)), 2);
    expect(rows.filter(r => r.length === 1 && r[0].startsWith("AMBITO")).map(r => r[0])).toEqual(["AMBITO API", "AMBITO Servicios"]);
  });
});
