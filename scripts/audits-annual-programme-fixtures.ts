import { writeZip } from "../src/lib/ooxml/zip";
import { programmeReferences, type ProgrammeContent, type ProgrammeRow } from "../src/modules/audits/annual-programme/domain";
const p = (v: string) => `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${v}</w:t></w:r></w:p>`;
const tc = (v: string, span = 1) => `<w:tc><w:tcPr>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}<w:shd w:fill="FFFF00"/></w:tcPr>${p(v)}</w:tc>`;
const tr = (v: string[]) => `<w:tr><w:trPr><w:trHeight w:val="800" w:hRule="exact"/></w:trPr>${v.map(s => tc(s)).join("")}</w:tr>`;
const table = (v: string) => `<w:tbl><w:tblPr><w:tblW w:w="10000" w:type="dxa"/></w:tblPr>${v}</w:tbl>`;
export function syntheticAnnualProgramme(internal: boolean) {
  const headers = internal ? ["DEPARTAMENTO AUDITADO", "", "FECHA PREVISTA", "AUDITORES", "REALIZADA", "CIERRE PARCIAL", "OBSERVACIONES"] : ["COMPAÑÍA", "FECHA PREVISTA", "AUDITORES", "REALIZADA", "OBSERVACIONES"];
  const main = table(tr(headers) + (internal ? tr(Array(7).fill("")) : `<w:tr>${tc("ÁMBITO ____", 5)}</w:tr>` + tr(Array(5).fill("")) + tr(Array(5).fill(""))));
  const approval = table(tr(["APROBADO POR:", "FIRMA/FECHA"]) + (internal ? tr(["Dirección Técnica", ""]) : "") + tr(["Dirección Garantía de Calidad", ""]));
  const master = internal ? "" : p("CUERPO MAESTRO NO EXPORTABLE") + `<w:p><w:pPr><w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:footerReference w:type="default" r:id="rId2"/></w:sectPr></w:pPr></w:p>` + p("ANEXO I");
  return writeZip([
    { name: "word/document.xml", data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${master}${p(internal ? "PROGRAMA ANUAL DE AUDITORIAS INTERNAS" : "PROGRAMA ANUAL DE AUDITORIAS EXTERNAS")}${p("AÑO: ____")}${main}${approval}${p(internal ? programmeReferences.INTERNAL : "PMAE/V05/06-2026")}<w:sectPr><w:pgSz w:w="16838" w:h="11906"/></w:sectPr></w:body></w:document>`) },
    { name: "word/header1.xml", data: Buffer.from(p("LOGO FICTICIO")) },
    { name: "word/footer1.xml", data: Buffer.from(p("Página")) },
    { name: "word/styles.xml", data: Buffer.from("<styles>conservar</styles>") },
    { name: "docProps/core.xml", data: Buffer.from("<core><dc:creator>Autor plantilla</dc:creator><cp:lastModifiedBy>Editor</cp:lastModifiedBy></core>") },
  ]);
}
export function syntheticProgrammeContent(internal = true, count = 1): ProgrammeContent {
  const row: ProgrammeRow = { entryId: "entry", auditId: null, subject: "Objeto", target: "Entidad ficticia & departamento", area: "Calidad", productService: "Servicio", scope: "Alcance", modality: "Remota", planned: "Primer trimestre", auditors: "Auditor ficticio", performed: "", partial: "", notes: "Notas <editables>", auditStatus: null, auditActive: null };
  return { schemaVersion: 1, planId: "plan", year: 2027, auditType: internal ? "INTERNAL" : "EXTERNAL", title: "Plan ficticio", reference: internal ? programmeReferences.INTERNAL : programmeReferences.EXTERNAL, technicalApproverName: "Aprobador técnico ficticio", qualityApproverName: "Aprobador calidad ficticio", warnings: [], rows: Array.from({ length: count }, (_, i) => ({ ...row, entryId: `entry-${i}`, target: `Entidad ficticia ${i + 1} & departamento`, area: i % 2 ? "Servicios" : "Calidad" })) };
}
