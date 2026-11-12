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
export function syntheticProgrammeContent(internal = true, count = 1, format: ProgrammeContent["format"] = "MASTER_PLAN"): ProgrammeContent {
  const row: ProgrammeRow = { entryId: "entry", auditId: null, subject: "Objeto", target: "Entidad ficticia & departamento", area: "Calidad", productService: "Servicio", scope: "Alcance", modality: "Remota", planned: "Primer trimestre", auditors: "Auditor ficticio", performed: "", partial: "", notes: "Notas <editables>", auditStatus: null, auditActive: null, code: "", comments: "Notas <editables>", cancelled: false };
  return { schemaVersion: 2, planId: "plan", year: 2027, auditType: internal ? "INTERNAL" : "EXTERNAL", format, title: "Plan ficticio", reference: internal ? programmeReferences.INTERNAL : programmeReferences.EXTERNAL, preparedByName: "Elaboradora ficticia", technicalApproverName: "Aprobador técnico ficticio", qualityApproverName: "Aprobador calidad ficticio", warnings: [], rows: Array.from({ length: count }, (_, i) => ({ ...row, entryId: `entry-${i}`, target: `Entidad ficticia ${i + 1} & departamento`, area: i % 2 ? "Servicios" : "Calidad" })) };
}
/**
 * D-135 (R6): Anexo V ficticio con la misma estructura que los de los PNT GC-00/033/04 y GC-00/034/05
 * (título, año y versión, tabla con dos filas de cabecera y firmas). Sin contenido de las plantillas reales.
 */
export function syntheticAnnexVProgramme(internal: boolean) {
  const header = (cells: string[]) => `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${cells.map(c => tc(c)).join("")}</w:tr>`;
  const plain = (cells: string[]) => `<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="620"/></w:trPr>${cells.map(c => tc(c)).join("")}</w:tr>`;
  const band = (repeat: boolean) => `<w:tr><w:trPr><w:cantSplit/>${repeat ? "<w:tblHeader/>" : ""}</w:trPr>${tc("AMBITO_", 8)}</w:tr>`;
  const columns = ["Nº", internal ? "Área y alcance" : "Entidad y alcance", "Fecha prevista ", "Equipo auditor", "Código de auditoría", "Fecha de auditoría", internal ? "Fecha de cierre (CAPA)" : "Fecha cierre parcial", "Comentarios"];
  const body = internal ? [1, 2, 3].map(n => plain([String(n), "", "", "", "", "", "", ""])).join("") : band(true) + plain(Array(8).fill("")) + band(false) + plain(Array(8).fill(""));
  const main = table(`<w:tr><w:trPr><w:tblHeader/></w:trPr>${tc("PLANIFICACIÓN", 4)}${tc("EJECUCIÓN Y SEGUIMIENTO", 4)}</w:tr>` + header(columns) + body);
  const signatures = table(header(["Función", "Nombre y apellido", "Firma", "Fecha"]) + plain(["Elaborado por Garantía de Calidad", "", "", ""]) + plain(["Aprobado por Dirección de Garantía de Calidad", "", "", ""]));
  const title = table(`<w:tr>${tc("")}${tc(internal ? "PROGRAMA ANUAL DE AUDITORÍAS INTERNAS" : "PROGRAMA ANUAL DE AUDITORÍAS EXTERNAS")}</w:tr>`);
  const year = table(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${tc("Año:")}${tc("")}${tc("Versión:")}${tc("")}</w:tr>`);
  const instruction = `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Añadir o eliminar tantas filas como sean necesarias. Instrucción ficticia.</w:t></w:r></w:p>`;
  return writeZip([
    { name: "word/document.xml", data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${title}${p("")}${year}${instruction}${main}${p("")}${signatures}<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr></w:body></w:document>`) },
    { name: "word/header1.xml", data: Buffer.from(p(`Anexo V del PNT GC-00/${internal ? "033/04" : "034/05"} (ficticio)`)) },
    { name: "word/footer1.xml", data: Buffer.from(p("Página")) },
    { name: "word/styles.xml", data: Buffer.from("<styles>conservar</styles>") },
    { name: "docProps/core.xml", data: Buffer.from("<core><dc:creator>Autor plantilla</dc:creator><cp:lastModifiedBy>Editor</cp:lastModifiedBy></core>") },
  ]);
}
