import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import {
  fillWordRowBalanced,
  replaceWordRowsRangeBalanced,
  setWordCellTextBalanced,
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadChangeAnnexVTemplate } from "@/modules/change-control/documents/templates";
import type {
  ChangeDocumentFollowup,
  ChangeDocumentRecord,
  ChangeDocumentTask,
} from "@/modules/change-control/documents/types";

function date(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("es-ES").format(value) : "";
}
function text(value: string | null | undefined) {
  return value ?? "";
}
function mark(checked: boolean, label: string) {
  return `${checked ? "☒" : "☐"} ${label}`;
}
function groupTasks(
  record: ChangeDocumentRecord,
  followup: ChangeDocumentFollowup,
) {
  const stateByTask = new Map(followup.taskStates.map((state) => [state.taskId, state]));
  const groups: Array<{ key: string; label: string; tasks: ChangeDocumentTask[] }> = [];
  for (const task of record.tasks) {
    const state = stateByTask.get(task.id);
    if (!state) continue;
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
  return { groups, stateByTask };
}

export function changeAnnexVTaskValues(
  task: Pick<ChangeDocumentTask, "description" | "responsible" | "plannedDate" | "origin">,
  state: { status: "PENDING" | "COMPLETED" | "NOT_APPLICABLE"; actualDate?: Date | null; evidenceComment?: string | null },
) {
  const status =
    state.status === "COMPLETED"
      ? "☒"
      : state.status === "NOT_APPLICABLE"
        ? "☒ N/A"
        : "☐";
  return [
    status,
    task.description,
    text(task.responsible),
    date(task.plannedDate),
    date(state.actualDate),
    text(state.evidenceComment),
  ];
}

export async function generateChangeAnnexV(
  record: ChangeDocumentRecord,
  followupSequence: number,
) {
  const followup = record.followups.find((item) => item.sequenceNumber === followupSequence);
  if (!followup) throw new Error(`No existe el seguimiento ${String(followupSequence).padStart(2, "0")}.`);

  const versionCode = record.annexVTemplateVersion?.versionCode ?? "03";
  const entries = readZip(await loadChangeAnnexVTemplate(versionCode));
  let xml = getZipEntryText(entries, "word/document.xml");

  xml = setWordCellTextBalanced(xml, 0, 1, 1, text(record.qmsRecord.businessCode));
  xml = setWordCellTextBalanced(xml, 0, 1, 3, date(followup.followupDate));
  // Fila 2: «N.º de seguimiento:» | número | «Historial de Seguimientos:» | historial (sustituye al ejemplo).
  // La celda del número va envuelta en un control de contenido y cuenta como celda.
  xml = setWordCellTextBalanced(xml, 0, 2, 1, String(followup.sequenceNumber).padStart(2, "0"));
  xml = setWordCellTextBalanced(
    xml,
    0,
    2,
    3,
    record.followups
      .filter((item) => item.sequenceNumber <= followup.sequenceNumber)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((item) => `${String(item.sequenceNumber).padStart(2, "0")} (${date(item.followupDate)})`)
      .join("\n"),
  );
  xml = setWordCellTextBalanced(xml, 0, 3, 0, `Responsable de Seguimiento: ${followup.responsible}`);

  const { groups, stateByTask } = groupTasks(record, followup);
  xml = replaceWordRowsRangeBalanced(xml, 1, 1, 12, ({ first, second }) =>
    groups.flatMap((group) => [
      fillWordRowBalanced(first, [{ text: group.label }]),
      ...group.tasks.map((task) => {
        const state = stateByTask.get(task.id)!;
        const isNew = task.origin === "FOLLOWUP";
        const color = isNew ? "0070C0" : undefined;
        return fillWordRowBalanced(
          second,
          changeAnnexVTaskValues(task, state).map((value) => ({ text: value, color })),
        );
      }),
    ]),
  );

  xml = setWordCellTextBalanced(
    xml,
    2,
    1,
    0,
    mark(followup.executionStatus === "EXECUTED", "EJECUTADO"),
  );
  xml = setWordCellTextBalanced(
    xml,
    2,
    1,
    1,
    mark(followup.executionStatus === "NOT_EXECUTED", "NO EJECUTADO"),
  );
  xml = setWordCellTextBalanced(xml, 2, 2, 1, date(followup.executionDate));
  xml = setWordCellTextBalanced(
    xml,
    2,
    4,
    0,
    mark(followup.effectivenessStatus === "ACCEPTABLE", "ACEPTABLE"),
  );
  xml = setWordCellTextBalanced(
    xml,
    2,
    4,
    1,
    mark(followup.effectivenessStatus === "NOT_ACCEPTABLE", "NO ACEPTABLE"),
  );
  xml = setWordCellTextBalanced(
    xml,
    2,
    4,
    2,
    mark(followup.effectivenessStatus === "PENDING", "PENDIENTE"),
  );
  // La plantilla solo ofrece Aceptable / No aceptable / Pendiente: «no aplica» se deja sin
  // casilla marcada y se indica en las observaciones de la comprobación.
  xml = setWordCellTextBalanced(
    xml,
    2,
    5,
    1,
    [
      followup.effectivenessStatus === "NOT_APPLICABLE" ? "Comprobación de la eficacia: no aplica." : "",
      text(followup.effectivenessObservations),
    ].filter(Boolean).join("\n"),
  );
  xml = setWordCellTextBalanced(xml, 2, 7, 1, mark(followup.closeChange, "SI"));
  xml = setWordCellTextBalanced(xml, 2, 7, 2, mark(!followup.closeChange, "NO"));
  xml = setWordCellTextBalanced(xml, 2, 7, 4, date(followup.nextFollowupDate));
  xml = setWordCellTextBalanced(xml, 2, 9, 1, text(followup.remainOpenReason));
  xml = setWordCellTextBalanced(xml, 2, 10, 1, text(followup.conclusion));
  xml = setWordCellTextBalanced(
    xml,
    2,
    11,
    0,
    // Los dos bloques de la plantilla se conservan; la aprobación se escribe bajo su etiqueta.
    [
      "Cierre del Seguimiento:",
      "",
      `Firma: ________________________ Fecha: ${date(followup.followupDate) || "____/____/______"}`,
      "",
      "Aprobación y cierre del cambio, si aplica (Gª Calidad / Dirección Técnica/Responsable Técnico actividad IPS)",
      text(followup.approvalByText),
      "Firma: _________________________Fecha: ____/____/______",
    ].join("\n"),
  );

  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}
