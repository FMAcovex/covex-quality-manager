import {
  buildAging,
  countLabels,
  inYearToDate,
  isDue,
  yearToDateWindow,
  type YearToDateComparison,
} from "@/lib/qms/analytics/trends";
import { scopeLabels } from "@/modules/change-control/domain";

export type ChangeAnalyticsRow = {
  openingYear: number | null;
  requestDate: Date | null;
  executionDate: Date | null;
  effectiveClosedAt: Date | null;
  finalStatus: "OPEN" | "CLOSED";
  classification: "MAJOR" | "MINOR" | null;
  executionStatus: "NOT_EXECUTED" | "EXECUTED";
  effectivenessStatus: "PENDING" | "ACCEPTABLE" | "NOT_ACCEPTABLE" | "NOT_APPLICABLE";
  departmentCode: string | null;
  plannedDates: Date[];
  /** Alcance del cambio (varios por expediente). */
  scopes?: string[];
};

export type ChangeDistribution = { label: string; count: number; percentage: number };

export type ChangeYearMetrics = {
  year: number;
  dataAvailable: boolean;
  total: number;
  openCurrent: number;
  major: number;
  minor: number;
  pendingEffectiveness: number;
  execution: {
    inTime: number;
    total: number;
    rate: number | null;
    medianDays: number | null;
  };
  effectiveness: {
    acceptable: number;
    notAcceptable: number;
    evaluated: number;
    rate: number | null;
    medianDaysToEffectiveness: number | null;
  };
  departments: ChangeDistribution[];
  classifications: ChangeDistribution[];
  executionStates: ChangeDistribution[];
};

const DAY = 86_400_000;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

export function daysBetween(a: Date | null, b: Date | null) {
  if (!a || !b) return null;
  const days = Math.round((b.getTime() - a.getTime()) / DAY);
  return days >= 0 ? days : null;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function plannedCompletionDate(row: ChangeAnalyticsRow) {
  if (!row.plannedDates.length) return null;
  return new Date(Math.max(...row.plannedDates.map((value) => value.getTime())));
}

function distribution(rows: ChangeAnalyticsRow[], get: (row: ChangeAnalyticsRow) => string) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = get(row);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return [...map.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: rows.length ? Math.round((count / rows.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

export function buildChangeYearMetrics(
  rows: ChangeAnalyticsRow[],
  year: number,
  dataAvailable = true,
): ChangeYearMetrics {
  const opened = rows.filter((row) => row.openingYear === year);
  const executed = rows.filter(
    (row) => row.executionDate?.getUTCFullYear() === year && row.executionStatus === "EXECUTED",
  );
  const evaluableExecution = executed.filter((row) => plannedCompletionDate(row));
  const inTime = evaluableExecution.filter(
    (row) => row.executionDate! <= plannedCompletionDate(row)!,
  ).length;
  const executionDays = executed
    .map((row) => daysBetween(row.requestDate, row.executionDate))
    .filter((value): value is number => value !== null);

  const evaluated = rows.filter(
    (row) =>
      row.effectiveClosedAt?.getUTCFullYear() === year &&
      (row.effectivenessStatus === "ACCEPTABLE" || row.effectivenessStatus === "NOT_ACCEPTABLE"),
  );
  const acceptable = evaluated.filter((row) => row.effectivenessStatus === "ACCEPTABLE").length;
  const efficacyDays = evaluated
    .map((row) => daysBetween(row.executionDate, row.effectiveClosedAt))
    .filter((value): value is number => value !== null);

  return {
    year,
    dataAvailable,
    total: opened.length,
    openCurrent: opened.filter((row) => row.finalStatus === "OPEN").length,
    major: opened.filter((row) => row.classification === "MAJOR").length,
    minor: opened.filter((row) => row.classification === "MINOR").length,
    pendingEffectiveness: opened.filter(
      (row) => row.executionStatus === "EXECUTED" && row.effectivenessStatus === "PENDING",
    ).length,
    execution: {
      inTime,
      total: evaluableExecution.length,
      rate: pct(inTime, evaluableExecution.length),
      medianDays: median(executionDays),
    },
    effectiveness: {
      acceptable,
      notAcceptable: evaluated.length - acceptable,
      evaluated: evaluated.length,
      rate: pct(acceptable, evaluated.length),
      medianDaysToEffectiveness: median(efficacyDays),
    },
    departments: distribution(opened, (row) => row.departmentCode ?? "Sin departamento"),
    classifications: distribution(opened, (row) =>
      row.classification === "MAJOR" ? "Mayor" : row.classification === "MINOR" ? "Menor" : "Sin clasificar",
    ),
    executionStates: distribution(opened, (row) =>
      row.executionStatus === "EXECUTED" ? "Ejecutado" : "No ejecutado",
    ),
  };
}

export function buildChangeFiveYearTrend(
  rows: ChangeAnalyticsRow[],
  endYear: number,
  covered: Set<number>,
) {
  return Array.from({ length: 5 }, (_, index) => endYear - 4 + index).map((year) =>
    buildChangeYearMetrics(rows, year, covered.has(year)),
  );
}

// Tendencias y pendientes (2026-10-17). Descriptivos: sin objetivos ni plazos del PNT.
export const CHANGE_PARETO = { department: "Departamento", scope: "Alcance", classification: "Clasificación" } as const;
export type ChangeParetoDimension = keyof typeof CHANGE_PARETO;

/** Alcances marcados en los controles abiertos en el año (un control puede tener varios). */
export function changeScopeDistribution(rows: ChangeAnalyticsRow[], year: number) {
  return countLabels(
    rows
      .filter((row) => row.openingYear === year)
      .flatMap((row) => (row.scopes?.length ? row.scopes.map((scope) => scopeLabels[scope] ?? scope) : ["Sin alcance indicado"])),
  );
}

export function buildChangeYearToDate(
  rows: ChangeAnalyticsRow[],
  selectedYear: number,
  covered: Set<number>,
  today: Date,
): YearToDateComparison {
  const window = yearToDateWindow(selectedYear, today);
  const period = (year: number) => {
    const inPeriod = (date: Date | null) => inYearToDate(window, year, date);
    const requested = rows.filter((row) => inPeriod(row.requestDate));
    const executed = rows.filter((row) => row.executionStatus === "EXECUTED" && inPeriod(row.executionDate));
    const evaluable = executed.filter((row) => plannedCompletionDate(row));
    const inTime = evaluable.filter((row) => row.executionDate! <= plannedCompletionDate(row)!).length;
    const evaluated = rows.filter((row) => inPeriod(row.effectiveClosedAt) && (row.effectivenessStatus === "ACCEPTABLE" || row.effectivenessStatus === "NOT_ACCEPTABLE"));
    return {
      requested: requested.length,
      major: requested.filter((row) => row.classification === "MAJOR").length,
      executed: executed.length,
      inTimeRate: pct(inTime, evaluable.length),
      evaluated: evaluated.length,
      acceptableRate: pct(evaluated.filter((row) => row.effectivenessStatus === "ACCEPTABLE").length, evaluated.length),
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
      { label: "Solicitudes", current: current.requested, previous: previous.requested, format: "count" },
      { label: "Mayores", current: current.major, previous: previous.major, format: "count" },
      { label: "Ejecutados", current: current.executed, previous: previous.executed, format: "count" },
      { label: "Ejecución en plazo", current: current.inTimeRate, previous: previous.inTimeRate, format: "percent" },
      { label: "Eficacias evaluadas", current: current.evaluated, previous: previous.evaluated, format: "count" },
      { label: "Eficacia aceptable", current: current.acceptableRate, previous: previous.acceptableRate, format: "percent" },
    ],
    note: "Solicitudes por fecha de solicitud; ejecución por fecha de ejecución; eficacia por fecha de cierre de eficacia.",
  };
}

export type ChangeBacklogRow = {
  id: string;
  code: string;
  requestDate: Date | null;
  classification: "MAJOR" | "MINOR" | null;
  executionStatus: "NOT_EXECUTED" | "EXECUTED";
  effectivenessStatus: ChangeAnalyticsRow["effectivenessStatus"];
  plannedDates: Date[];
  nextFollowupDate: Date | null;
};

/** Controles abiertos hoy: antigüedad desde la solicitud y fecha prevista superada sin ejecutar. */
export function buildChangeBacklog(rows: ChangeBacklogRow[], today: Date) {
  const overdue = (row: ChangeBacklogRow) => {
    if (row.executionStatus === "EXECUTED" || !row.plannedDates.length) return false;
    return isDue(new Date(Math.max(...row.plannedDates.map((date) => date.getTime()))), today, false);
  };
  const pendingEffectiveness = (row: ChangeBacklogRow) => row.executionStatus === "EXECUTED" && row.effectivenessStatus === "PENDING";
  return {
    ...buildAging(rows.map((row) => ({
      id: row.id,
      code: row.code,
      startDate: row.requestDate,
      tags: [row.classification === "MAJOR" ? "MAJOR" : null, overdue(row) ? "OVERDUE" : null, pendingEffectiveness(row) ? "EFFECTIVENESS" : null]
        .filter((tag): tag is string => Boolean(tag)),
      note: [row.classification === "MAJOR" ? "Mayor" : row.classification === "MINOR" ? "Menor" : null, overdue(row) ? "prevista superada" : null]
        .filter(Boolean).join(" · ") || null,
    })), today),
    overdue: rows.filter(overdue).length,
    pendingEffectiveness: rows.filter(pendingEffectiveness).length,
    // Mismo criterio que el listado: próximo seguimiento del último registro hoy o antes.
    followupDue: rows.filter((row) => isDue(row.nextFollowupDate, today)).length,
  };
}
