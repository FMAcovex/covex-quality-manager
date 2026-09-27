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
