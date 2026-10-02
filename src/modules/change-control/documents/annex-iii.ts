import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { setWordCellTextBalanced } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadChangeAnnexIIITemplate } from "@/modules/change-control/documents/templates";
import type { ChangeDocumentRecord } from "@/modules/change-control/documents/types";

function date(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}

function text(value: string | null | undefined) {
  return value ?? "";
}

function mark(checked: boolean, label: string) {
  return `${checked ? "☒" : "☐"} ${label}`;
}

function scopeText(record: ChangeDocumentRecord) {
  const selected = new Set(record.scope);
  return [
    mark(selected.has("INSTALLATIONS"), "Instalaciones"),
    mark(selected.has("EQUIPMENT"), "Equipos"),
    mark(selected.has("PROCESS"), "Proceso"),
    mark(selected.has("MATERIAL"), "Material/MP"),
    mark(selected.has("SUPPLIER"), "Proveedor"),
    mark(selected.has("DOCUMENTATION"), "Documentación"),
    mark(selected.has("OTHER"), "Otros"),
    `Especificar: ${text(record.otherScope)}`,
  ].join("   ");
}

export async function generateChangeAnnexIII(record: ChangeDocumentRecord) {
  const versionCode = record.annexIIITemplateVersion?.versionCode ?? "03";
  const entries = readZip(await loadChangeAnnexIIITemplate(versionCode));
  let xml = getZipEntryText(entries, "word/document.xml");

  xml = setWordCellTextBalanced(xml, 0, 1, 1, text(record.qmsRecord.businessCode));
  xml = setWordCellTextBalanced(xml, 0, 1, 3, date(record.requestDate));
  xml = setWordCellTextBalanced(xml, 0, 2, 1, scopeText(record));
  xml = setWordCellTextBalanced(
    xml,
    0,
    3,
    1,
    [record.departmentCodeSnapshot, record.departmentNameSnapshot].filter(Boolean).join(" - "),
  );
  xml = setWordCellTextBalanced(
    xml,
    0,
    5,
    0,
    `Nombre y Apellido: ${text(record.requesterName)}\nPuesto: ${text(record.requesterPosition)}`,
  );
  xml = setWordCellTextBalanced(xml, 0, 7, 0, text(record.description));
  xml = setWordCellTextBalanced(xml, 0, 9, 0, text(record.justification));
  xml = setWordCellTextBalanced(xml, 0, 11, 0, text(record.providedDocuments));
  xml = setWordCellTextBalanced(
    xml,
    0,
    13,
    1,
    `${mark(record.requestDecision === "ACCEPTED", "ACEPTADA")}          ${mark(record.requestDecision === "DENIED", "DENEGADA")}`,
  );
  xml = setWordCellTextBalanced(
    xml,
    0,
    14,
    1,
    [record.requestDecisionRole, record.requestDecisionResponsible].filter(Boolean).join(" - "),
  );
  xml = setWordCellTextBalanced(
    xml,
    0,
    15,
    0,
    [
      `Responsable de dictamen: ${text(record.requestDecisionResponsible)}`,
      record.requestDecisionRole ? `Cargo: ${record.requestDecisionRole}` : "",
      "Firma: __________________",
      `Fecha: ${date(record.requestDecisionDate)}`,
    ].filter(Boolean).join("\n"),
  );

  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
