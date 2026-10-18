import { describe, expect, it } from "vitest";
import { syntheticAnnualProgramme, syntheticProgrammeContent } from "../../../../scripts/audits-annual-programme-fixtures";
import { generateAnnualProgramme } from "./generator";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { entrySchema } from "../plans";
import { programmeDownloadName, programmeFingerprint } from "./domain";
describe("Programa anual sobre plantilla oficial compatible", () => {
  it.each([true, false])("adapta filas y conserva recursos, interno=%s", internal => {
    const source = syntheticAnnualProgramme(internal), content = syntheticProgrammeContent(internal, 20);
    const out = readZip(generateAnnualProgramme(source, content)), xml = getZipEntryText(out, "word/document.xml");
    expect(xml).toContain("Entidad ficticia 20 &amp; departamento");
    expect(xml).toContain("Notas &lt;editables&gt;");
    // D-103: el año y el ámbito van en su propio run (Arial 11); se comprueba el texto visible.
    const visibleText = xml.replace(/<[^>]+>/g, "");
    expect(visibleText).toContain("AÑO: 2027");
    expect(xml).toMatch(/<w:sz w:val="22"\/><w:szCs w:val="22"\/><\/w:rPr><w:t xml:space="preserve">2027<\/w:t>/);
    expect(xml).toContain("Aprobador calidad ficticio");
    expect(xml).toContain("Dirección Garantía de Calidad");
    expect(xml).toContain("<w:tblHeader/>");
    for (const r of xml.match(/<w:tr[^>]*>[\s\S]*?<\/w:tr>/g) || []) {
      if (r.includes("Entidad ficticia") || r.includes("Aprobador calidad ficticio")) expect(r).not.toContain('w:hRule="exact"');
    }
    for (const name of ["word/styles.xml", "word/header1.xml", "word/footer1.xml"]) expect(getZipEntryText(out, name)).toBe(getZipEntryText(readZip(source), name));
    expect(getZipEntryText(out, "docProps/core.xml")).not.toContain("Autor plantilla");
    if (!internal) { expect(xml).not.toContain("CUERPO MAESTRO"); expect(xml).toContain('w:start="1"'); expect(xml).toContain('r:id="rId1"'); expect(visibleText).toContain("ÁMBITO Servicios"); }
  });
  it("rechaza otra plantilla en vez de fabricar un formato", () => expect(() => generateAnnualProgramme(syntheticAnnualProgramme(false), syntheticProgrammeContent())).toThrow());
  it("rechaza estructura inesperada de aprobación", () => {
    const entries = readZip(syntheticAnnualProgramme(true));
    updateZipEntry(entries, "word/document.xml", getZipEntryText(entries, "word/document.xml").replace("APROBADO POR:", "Otro bloque"));
    expect(() => generateAnnualProgramme(writeZip(entries), syntheticProgrammeContent())).toThrow(/Tablas/);
  });
  it("no confunde cierre parcial externo con cierre final", () => {
    const c = syntheticProgrammeContent(false); c.rows[0].partial = "08/10/2026";
    expect(getZipEntryText(readZip(generateAnnualProgramme(syntheticAnnualProgramme(false), c)), "word/document.xml")).toContain("Cierre parcial: 08/10/2026");
  });
  it("reconoce cambios y usa una secuencia independiente de la versión maestra", () => {
    const c = syntheticProgrammeContent(), before = programmeFingerprint(c); c.rows[0].notes = "Cambio posterior";
    expect(programmeFingerprint(c)).not.toBe(before);
    expect(programmeDownloadName("INTERNAL", 2027, 1)).toBe("Programa_anual_interno_2027_R01.docx");
  });
  it("conserva compatibilidad con entradas anteriores y rechaza fecha más período", () => {
    const v = { subject: "Objeto", targetName: "Entidad", departmentId: "", plannedDate: "2027-01-02", notes: "", actor: "QA", reason: "" };
    expect(entrySchema.parse(v).plannedPeriodText).toBeUndefined();
    expect(entrySchema.safeParse({ ...v, plannedPeriodText: "Primer trimestre" }).success).toBe(false);
  });
});
