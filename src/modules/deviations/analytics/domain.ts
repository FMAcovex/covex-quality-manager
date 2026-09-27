export type AnalyticsRow = {
  openingYear: number | null;
  issueDate: Date | null;
  closedAt: Date | null;
  status: "OPEN" | "CLOSED";
  classification: "CRITICAL" | "MAJOR" | "MINOR" | null;
  recurrentRootCause: "YES" | "NO" | "NA" | null;
  affectsFinishedProduct: "YES" | "NO" | "NA" | null;
  provenance: string | null;
  departmentCode: string | null;
  departmentName: string | null;
  capaRequired: boolean | null;
  capaCount: number;
};

export type RateMetric = {
  numerator: number;
  denominator: number;
  rate: number | null;
  coverage: number;
  missing: number;
};

export type DistributionItem = {
  label: string;
  count: number;
  percentage: number;
};

export type YearMetrics = {
  year: number;
  total: number;
  openCurrent: number;
  critical: number;
  major: number;
  withCapa: number;
  withCapaRate: number | null;
  recurrence: RateMetric;
  affectsProduct: RateMetric;
  closure: {
    within30: number;
    total: number;
    rate: number | null;
    medianDays: number | null;
  };
  data: {
    complete: number;
    review: number;
    completeness: number | null;
  };
  areas: DistributionItem[];
  classifications: DistributionItem[];
  origins: DistributionItem[];
  monthlyOpenings: number[];
};

const DAY_MS = 86_400_000;

export function yearOf(value: Date | null) {
  return value ? value.getUTCFullYear() : null;
}

export function closingDays(row: Pick<AnalyticsRow, "issueDate" | "closedAt">) {
  if (!row.issueDate || !row.closedAt) return null;
  const days = Math.round((row.closedAt.getTime() - row.issueDate.getTime()) / DAY_MS);
  return days >= 0 ? days : null;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function percent(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function rateMetric(
  rows: AnalyticsRow[],
  value: (row: AnalyticsRow) => "YES" | "NO" | "NA" | null,
): RateMetric {
  const evaluated = rows.filter((row) => value(row) === "YES" || value(row) === "NO");
  const numerator = evaluated.filter((row) => value(row) === "YES").length;
  return {
    numerator,
    denominator: evaluated.length,
    rate: percent(numerator, evaluated.length),
    coverage: rows.length ? Math.round((evaluated.length / rows.length) * 1000) / 10 : 0,
    missing: rows.length - evaluated.length,
  };
}

export function hasCapa(row: Pick<AnalyticsRow, "capaRequired" | "capaCount">) {
  return row.capaRequired === true || row.capaCount > 0;
}

export function isKpiComplete(row: AnalyticsRow) {
  return Boolean(
    row.issueDate &&
      row.classification &&
      (row.recurrentRootCause === "YES" || row.recurrentRootCause === "NO") &&
      (row.affectsFinishedProduct === "YES" || row.affectsFinishedProduct === "NO") &&
      row.provenance?.trim(),
  );
}

function distribution(rows: AnalyticsRow[], label: (row: AnalyticsRow) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = label(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([item, count]) => ({
      label: item,
      count,
      percentage: rows.length ? Math.round((count / rows.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function classificationLabel(value: AnalyticsRow["classification"]) {
  if (value === "CRITICAL") return "Crítica";
  if (value === "MAJOR") return "Mayor";
  if (value === "MINOR") return "Menor";
  return "Sin clasificar";
}

export function buildYearMetrics(rows: AnalyticsRow[], year: number): YearMetrics {
  const opened = rows.filter((row) => row.openingYear === year);
  const closed = rows.filter((row) => yearOf(row.closedAt) === year && closingDays(row) !== null);
  const closingValues = closed
    .map((row) => closingDays(row))
    .filter((value): value is number => value !== null);
  const within30 = closingValues.filter((days) => days <= 30).length;
  const capaCount = opened.filter(hasCapa).length;
  const complete = opened.filter(isKpiComplete).length;
  const monthlyOpenings = Array.from({ length: 12 }, () => 0);

  for (const row of opened) {
    if (!row.issueDate) continue;
    monthlyOpenings[row.issueDate.getUTCMonth()] += 1;
  }

  return {
    year,
    total: opened.length,
    openCurrent: opened.filter((row) => row.status === "OPEN").length,
    critical: opened.filter((row) => row.classification === "CRITICAL").length,
    major: opened.filter((row) => row.classification === "MAJOR").length,
    withCapa: capaCount,
    withCapaRate: percent(capaCount, opened.length),
    recurrence: rateMetric(opened, (row) => row.recurrentRootCause),
    affectsProduct: rateMetric(opened, (row) => row.affectsFinishedProduct),
    closure: {
      within30,
      total: closingValues.length,
      rate: percent(within30, closingValues.length),
      medianDays: median(closingValues),
    },
    data: {
      complete,
      review: opened.length - complete,
      completeness: percent(complete, opened.length),
    },
    areas: distribution(opened, (row) => row.departmentCode ?? "Sin área"),
    classifications: distribution(opened, (row) => classificationLabel(row.classification)),
    origins: distribution(opened, (row) => row.provenance?.trim() || "Sin origen informado"),
    monthlyOpenings,
  };
}

export function buildFiveYearTrend(rows: AnalyticsRow[], endYear: number) {
  return Array.from({ length: 5 }, (_, index) => endYear - 4 + index).map((year) =>
    buildYearMetrics(rows, year),
  );
}
