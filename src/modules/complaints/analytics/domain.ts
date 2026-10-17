import {
  buildAging,
  countLabels,
  daysFromTo,
  inYearToDate,
  isDue,
  medianOf,
  percentOf,
  yearToDateWindow,
  type YearToDateComparison,
} from "@/lib/qms/analytics/trends";
import { complaintCategoryOptions, complaintSourceOptions } from "@/modules/complaints/domain";

// Tendencias y pendientes de Reclamaciones (2026-10-17). Descriptivos: sin objetivos ni
// plazos del PNT; sin tasa por unidades o lotes distribuidos (D-090).

export type ComplaintTrendRow = {
  openingYear: number | null;
  openedAt: Date | null;
  closedAt: Date | null;
  receptionDate: Date | null;
  responseDate: Date | null;
  classification: "CRITICAL" | "MAJOR" | "MINOR" | "NO_GMP_IMPACT" | null;
  recurrent: boolean | null;
  categoryTypes: string[];
  sourceTypes: string[];
  rootCauseCategories?: string[];
};

export const COMPLAINT_PARETO = {
  category: "Categoría",
  classification: "Clasificación",
  source: "Origen",
  department: "Departamento",
  rootCause: "Causa raíz (6M)",
} as const;
export type ComplaintParetoDimension = keyof typeof COMPLAINT_PARETO;

const categoryLabels: Record<string, string> = Object.fromEntries(complaintCategoryOptions);
const sourceLabels: Record<string, string> = Object.fromEntries(complaintSourceOptions);

/** Categorías o fuentes marcadas en las reclamaciones del año (una reclamación puede tener varias). */
export function complaintMentions(rows: ComplaintTrendRow[], year: number, field: "categoryTypes" | "sourceTypes") {
  const labels = field === "categoryTypes" ? categoryLabels : sourceLabels;
  const empty = field === "categoryTypes" ? "Sin categoría indicada" : "Sin origen indicado";
  return countLabels(
    rows
      .filter((row) => row.openingYear === year)
      .flatMap((row) => (row[field].length ? row[field].map((value) => labels[value] ?? value) : [empty])),
  );
}

/** Días naturales desde la recepción hasta la respuesta al cliente o proveedor. */
export function responseDays(row: Pick<ComplaintTrendRow, "receptionDate" | "responseDate">) {
  return daysFromTo(row.receptionDate, row.responseDate);
}

/** Mediana recepción→respuesta de las respuestas emitidas en el año. */
export function medianResponseDays(rows: ComplaintTrendRow[], year: number) {
  return medianOf(
    rows
      .filter((row) => row.responseDate?.getUTCFullYear() === year)
      .map(responseDays)
      .filter((days): days is number => days !== null),
  );
}

export function buildComplaintYearToDate(
  rows: ComplaintTrendRow[],
  selectedYear: number,
  covered: Set<number>,
  today: Date,
): YearToDateComparison {
  const window = yearToDateWindow(selectedYear, today);
  const period = (year: number) => {
    const inPeriod = (date: Date | null) => inYearToDate(window, year, date);
    const opened = rows.filter((row) => inPeriod(row.openedAt));
    const evaluated = opened.filter((row) => row.recurrent !== null);
    return {
      opened: opened.length,
      critical: opened.filter((row) => row.classification === "CRITICAL").length,
      major: opened.filter((row) => row.classification === "MAJOR").length,
      closed: rows.filter((row) => inPeriod(row.closedAt)).length,
      recurrence: percentOf(evaluated.filter((row) => row.recurrent).length, evaluated.length),
      response: medianOf(rows.filter((row) => inPeriod(row.responseDate)).map(responseDays).filter((days): days is number => days !== null)),
    };
  };
  const current = period(selectedYear);
  const previous = period(selectedYear - 1);
  return {
    ...window,
    currentYear: selectedYear,
    previousYear: selectedYear - 1,
    currentAvailable: covered.has(selectedYear),
    previousAvailable: covered.has(selectedYear - 1),
    rows: [
      { label: "Recibidas", current: current.opened, previous: previous.opened, format: "count" },
      { label: "Críticas", current: current.critical, previous: previous.critical, format: "count" },
      { label: "Mayores", current: current.major, previous: previous.major, format: "count" },
      { label: "Cierres", current: current.closed, previous: previous.closed, format: "count" },
      { label: "Recurrentes", current: current.recurrence, previous: previous.recurrence, format: "percent" },
      { label: "Mediana recepción→respuesta", current: current.response, previous: previous.response, format: "days" },
    ],
    note: "Recibidas por fecha de apertura; cierres y respuestas por su propia fecha. Recurrencia sobre las evaluadas.",
  };
}

export type ComplaintBacklogRow = {
  id: string;
  code: string;
  openedAt: Date | null;
  classification: ComplaintTrendRow["classification"];
  nextFollowupDate: Date | null;
  partIIRequired: boolean | null;
  conclusion: string | null;
  effectivenessStatus: string;
};

const classificationLabel = { CRITICAL: "Crítica", MAJOR: "Mayor", MINOR: "Menor", NO_GMP_IMPACT: "Sin impacto GMP" } as const;

/** Reclamaciones abiertas hoy; contadores con el mismo criterio que el listado. */
export function buildComplaintBacklog(rows: ComplaintBacklogRow[], today: Date) {
  return {
    ...buildAging(rows.map((row) => ({
      id: row.id,
      code: row.code,
      startDate: row.openedAt,
      tags: row.classification ? [row.classification] : [],
      note: row.classification ? classificationLabel[row.classification] : null,
    })), today),
    followupDue: rows.filter((row) => isDue(row.nextFollowupDate, today, false)).length,
    pendingPartII: rows.filter((row) => row.partIIRequired === null && row.conclusion !== null).length,
    pendingEffectiveness: rows.filter((row) => row.partIIRequired === true && row.effectivenessStatus === "PENDING").length,
  };
}
