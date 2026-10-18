import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import {
  fillWordRowBalanced,
  replaceWordRowsRangeBalanced,
  setWordCellTextBalanced,
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadChangeAnnexIVTemplate } from "@/modules/change-control/documents/templates";
import type { ChangeDocumentRecord, ChangeDocumentTask } from "@/modules/change-control/documents/types";

function date(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}
function text(value: string | null | undefined) {
  return value ?? "";
}
function mark(checked: boolean, label: string) {
  return `${checked ? "☒" : "☐"} ${label}`;
}
/** Etiqueta de la plantilla seguida del dato; sin dato se conserva la línea de relleno. */
function labelled(label: string, value: string | null | undefined, blank = "____________________________________________") {
  return `${label}\n${value?.trim() ? value.trim() : blank}`;
}
function yesNo(value: boolean | null | undefined) {
  return `${mark(value === true, "Sí")}   ${mark(value === false, "No")}`;
}
function triState(value: "YES" | "NO" | "NA" | null | undefined) {
  return [
    mark(value === "YES", "Sí"),
    mark(value === "NO", "No"),
    mark(value === "NA", "No Aplica"),
  ].join("   ");
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
function groupTasks(tasks: ChangeDocumentTask[]) {
  const groups: Array<{ key: string; label: string; tasks: ChangeDocumentTask[] }> = [];
  for (const task of tasks.filter((item) => item.origin === "DICTAMEN")) {
    const key = task.departmentId || task.departmentCodeSnapshot || "SIN_DEP";
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = {
        key,
        label: [task.departmentCodeSnapshot, task.departmentNameSnapshot].filter(Boolean).join(" - ") || "Departamento",
        tasks: [],
      };
      groups.push(group);
    }
    group.tasks.push(task);
  }
  return groups;
}

export async function generateChangeAnnexIV(record: ChangeDocumentRecord) {
  const versionCode = record.annexIVTemplateVersion?.versionCode ?? "03";
  const entries = readZip(await loadChangeAnnexIVTemplate(versionCode));
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
  xml = setWordCellTextBalanced(xml, 0, 5, 0, text(record.evaluation));
  xml = setWordCellTextBalanced(
    xml,
    0,
    6,
    1,
    `${mark(record.classification === "MAJOR", "MAYOR")}         ${mark(record.classification === "MINOR", "MENOR")}`,
  );
  xml = setWordCellTextBalanced(xml, 0, 6, 3, date(record.plannedImplementationDate));

  const groups = groupTasks(record.tasks);
  xml = replaceWordRowsRangeBalanced(xml, 1, 1, 12, ({ first, second }) =>
    groups.flatMap((group) => [
      fillWordRowBalanced(first, [{ text: group.label }]),
      ...group.tasks.map((task) =>
        fillWordRowBalanced(second, [
          { text: task.description },
          { text: text(task.responsible) },
          { text: date(task.plannedDate) },
        ]),
      ),
    ]),
  );

  xml = setWordCellTextBalanced(xml, 3, 0, 1, yesNo(record.committeeRequired));
  xml = setWordCellTextBalanced(xml, 3, 0, 2, labelled("Justificar e indicar personal/departamentos implicados:", record.committeeDetails));
  xml = setWordCellTextBalanced(xml, 3, 1, 1, yesNo(record.clientNotificationRequired));
  xml = setWordCellTextBalanced(xml, 3, 1, 2, labelled("(si Sí, indicar fecha y evidencia):", record.clientNotificationDetails));
  xml = setWordCellTextBalanced(xml, 3, 2, 1, yesNo(record.authorityRequired));
  xml = setWordCellTextBalanced(xml, 3, 2, 2, labelled("(si Sí, indicar detalle):", record.authorityDetails));
  xml = setWordCellTextBalanced(xml, 3, 3, 1, triState(record.pqrRequired));
  xml = setWordCellTextBalanced(
    xml,
    3,
    3,
    2,
    `Producto(s): ${record.pqrProducts?.trim() || "________________"}\nPeriodo PQR: ${record.pqrPeriod?.trim() || "_______________"}`,
  );
  xml = setWordCellTextBalanced(xml, 3, 4, 1, triState(record.stabilityRequired));
  xml = setWordCellTextBalanced(
    xml,
    3,
    4,
    2,
    // Orden de la plantilla: etiqueta y después la casilla.
    `E. acelerada   ${record.stabilityAccelerated ? "☒" : "☐"}\nE. en curso     ${record.stabilityOngoing ? "☒" : "☐"}`,
  );
  xml = setWordCellTextBalanced(xml, 3, 5, 1, triState(record.additionalAnalysisRequired));
  xml = setWordCellTextBalanced(xml, 3, 5, 2, labelled("Especificar:", record.additionalAnalysisDetails));
  xml = setWordCellTextBalanced(xml, 3, 6, 1, triState(record.additionalValidationRequired));
  xml = setWordCellTextBalanced(xml, 3, 6, 2, labelled("Detalles:", record.additionalValidationDetails));
  xml = setWordCellTextBalanced(xml, 3, 7, 1, yesNo(record.otherImplicationRequired));
  xml = setWordCellTextBalanced(xml, 3, 7, 2, labelled("Especificar:", record.otherImplicationDetails));

  xml = setWordCellTextBalanced(
    xml,
    2,
    3,
    1,
    `${mark(record.dictamenResult === "APPROVED", "APROBADO")}      ${mark(record.dictamenResult === "REJECTED", "RECHAZADO")}`,
  );
  xml = setWordCellTextBalanced(xml, 2, 3, 3, date(record.dictamenDate));
  xml = setWordCellTextBalanced(xml, 2, 4, 1, text(record.followupResponsible));
  xml = setWordCellTextBalanced(xml, 2, 5, 1, text(record.dictamenObservations));
  xml = setWordCellTextBalanced(
    xml,
    2,
    7,
    0,
    [
      `Nombre(s) y cargo(s): ${text(record.approvalNames)}`,
      "Firma(s): ________________________________",
      `Fecha: ${date(record.dictamenDate)}`,
    ].join("\n"),
  );

  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
