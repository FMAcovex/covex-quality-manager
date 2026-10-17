export type AnalyticsRow = {
  openingYear: number | null;
  issueDate: Date | null;
  closedAt: Date | null;
  status: "DRAFT" | "OPEN" | "CLOSED";
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
  dataAvailable: boolean;
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

export function buildYearMetrics(
  rows: AnalyticsRow[],
  year: number,
  dataAvailable = true,
): YearMetrics {
  const operationalRows = rows.filter((row) => row.status !== "DRAFT");
  const opened = operationalRows.filter((row) => row.openingYear === year);
  const closed = operationalRows.filter((row) => yearOf(row.closedAt) === year && closingDays(row) !== null);
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
    dataAvailable,
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

export function buildFiveYearTrend(
  rows: AnalyticsRow[],
  endYear: number,
  coveredYears?: Set<number>,
) {
  return Array.from({ length: 5 }, (_, index) => endYear - 4 + index).map((year) =>
    buildYearMetrics(rows, year, coveredYears ? coveredYears.has(year) : true),
  );
}

// Antigüedad de las desviaciones abiertas hoy (piloto). Tramos descriptivos: no son
// plazos del PNT ni objetivos; el plazo aplicable lo marca «En plazo» de cada expediente.
export const BACKLOG_BUCKETS = [
  { key: "0-30", label: "0–30 días", max: 30 },
  { key: "31-60", label: "31–60 días", max: 60 },
  { key: "61-90", label: "61–90 días", max: 90 },
  { key: "90+", label: "Más de 90 días", max: Number.POSITIVE_INFINITY },
] as const;

export type BacklogRow = {
  id: string;
  code: string;
  issueDate: Date | null;
  classification: "CRITICAL" | "MAJOR" | "MINOR" | null;
  outOfTime: boolean;
  nextFollowupDate: Date | null;
};

export type DeviationBacklog = {
  total: number;
  withoutIssueDate: number;
  medianAgeDays: number | null;
  outOfTime: number;
  followupDue: number;
  buckets: Array<{ key: string; label: string; count: number; percentage: number; critical: number; major: number }>;
  oldest: Array<{ id: string; code: string; ageDays: number; classification: BacklogRow["classification"] }>;
};

/** Días naturales desde la apertura hasta hoy (fechas UTC sin hora). */
export function ageInDays(issueDate: Date, today: Date) {
  const start = Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), issueDate.getUTCDate());
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export function buildBacklog(rows: BacklogRow[], today: Date, oldestLimit = 5): DeviationBacklog {
  const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const aged = rows
    .filter((row) => row.issueDate)
    .map((row) => ({ ...row, ageDays: ageInDays(row.issueDate!, today) }));
  const buckets = BACKLOG_BUCKETS.map((bucket, index) => {
    const min = index === 0 ? 0 : BACKLOG_BUCKETS[index - 1].max + 1;
    const inBucket = aged.filter((row) => row.ageDays >= min && row.ageDays <= bucket.max);
    return {
      key: bucket.key,
      label: bucket.label,
      count: inBucket.length,
      percentage: aged.length ? Math.round((inBucket.length / aged.length) * 1000) / 10 : 0,
      critical: inBucket.filter((row) => row.classification === "CRITICAL").length,
      major: inBucket.filter((row) => row.classification === "MAJOR").length,
    };
  });
  return {
    total: rows.length,
    withoutIssueDate: rows.length - aged.length,
    medianAgeDays: median(aged.map((row) => row.ageDays)),
    outOfTime: rows.filter((row) => row.outOfTime).length,
    // Mismo criterio que el listado: el próximo seguimiento del último registro vence hoy o antes.
    followupDue: rows.filter((row) => row.nextFollowupDate && row.nextFollowupDate.getTime() <= todayStart).length,
    buckets,
    oldest: [...aged]
      .sort((a, b) => b.ageDays - a.ageDays || a.code.localeCompare(b.code, "es"))
      .slice(0, oldestLimit)
      .map(({ id, code, ageDays, classification }) => ({ id, code, ageDays, classification })),
  };
}

// Tendencias (piloto, 2026-10-17). Descriptivas: sin objetivos, límites de control ni plazos del PNT.
export const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;

export type MonthlyPoint = {
  year: number;
  /** 0 = enero. */
  month: number;
  /** null: año sin datos cargados (no es cero). */
  count: number | null;
  /** Mes en curso: datos parciales. */
  partial: boolean;
  /** Media de los 12 meses que terminan en este; null si alguno no tiene datos o es parcial. */
  rolling12: number | null;
};

/** Último mes del gráfico: el mes en curso si se analiza el año actual, diciembre si es pasado. */
export function seriesEnd(selectedYear: number, today: Date) {
  const currentYear = today.getUTCFullYear();
  if (selectedYear < currentYear) return { year: selectedYear, month: 11, partial: false };
  if (selectedYear > currentYear) return { year: selectedYear, month: 11, partial: true };
  return { year: currentYear, month: today.getUTCMonth(), partial: true };
}

export function buildMonthlySeries(
  rows: AnalyticsRow[],
  selectedYear: number,
  coveredYears: Set<number>,
  today: Date,
  length = 36,
): MonthlyPoint[] {
  const end = seriesEnd(selectedYear, today);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.status === "DRAFT" || !row.issueDate) continue;
    const key = `${row.issueDate.getUTCFullYear()}-${row.issueDate.getUTCMonth()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // 11 meses previos para que el primer punto visible ya tenga media de 12 meses.
  const total = length + 11;
  const all = Array.from({ length: total }, (_, index) => {
    const offset = end.year * 12 + end.month - (total - 1 - index);
    const year = Math.floor(offset / 12);
    const month = offset % 12;
    const partial = end.partial && year === end.year && month === end.month;
    const count = coveredYears.has(year) ? counts.get(`${year}-${month}`) ?? 0 : null;
    return { year, month, count, partial };
  });
  return all.slice(11).map((point, index) => {
    const window = all.slice(index, index + 12);
    const complete = window.every((item) => item.count !== null && !item.partial);
    const rolling12 = complete
      ? Math.round((window.reduce((sum, item) => sum + (item.count ?? 0), 0) / 12) * 10) / 10
      : null;
    return { ...point, rolling12 };
  });
}

export type PeriodMetrics = {
  dataAvailable: boolean;
  openings: number;
  critical: number;
  major: number;
  closures: number;
  closedWithin30: number;
  closureRate: number | null;
};

export type YearToDate = {
  /** Mismo día y mes en ambos años; 31 de diciembre si el año analizado ya terminó. */
  cutoffMonth: number;
  cutoffDay: number;
  fullYear: boolean;
  current: PeriodMetrics & { year: number };
  previous: PeriodMetrics & { year: number };
  withoutIssueDate: number;
};

function periodMetrics(rows: AnalyticsRow[], year: number, cutoffMonth: number, cutoffDay: number, dataAvailable: boolean) {
  const from = Date.UTC(year, 0, 1);
  // Hasta el final del día de corte; el 29 de febrero se acota al último día del mes.
  const lastDay = Math.min(cutoffDay, new Date(Date.UTC(year, cutoffMonth + 1, 0)).getUTCDate());
  const to = Date.UTC(year, cutoffMonth, lastDay + 1);
  const inPeriod = (value: Date | null) => value !== null && value.getTime() >= from && value.getTime() < to;
  const operational = rows.filter((row) => row.status !== "DRAFT");
  const opened = operational.filter((row) => inPeriod(row.issueDate));
  const closed = operational.filter((row) => inPeriod(row.closedAt) && closingDays(row) !== null);
  const closedWithin30 = closed.filter((row) => (closingDays(row) ?? Infinity) <= 30).length;
  return {
    year,
    dataAvailable,
    openings: opened.length,
    critical: opened.filter((row) => row.classification === "CRITICAL").length,
    major: opened.filter((row) => row.classification === "MAJOR").length,
    closures: closed.length,
    closedWithin30,
    closureRate: percent(closedWithin30, closed.length),
  };
}

export function buildYearToDate(rows: AnalyticsRow[], selectedYear: number, coveredYears: Set<number>, today: Date): YearToDate {
  const end = seriesEnd(selectedYear, today);
  const fullYear = selectedYear !== today.getUTCFullYear();
  const cutoffMonth = fullYear ? 11 : end.month;
  const cutoffDay = fullYear ? 31 : today.getUTCDate();
  return {
    cutoffMonth,
    cutoffDay,
    fullYear,
    current: periodMetrics(rows, selectedYear, cutoffMonth, cutoffDay, coveredYears.has(selectedYear)),
    previous: periodMetrics(rows, selectedYear - 1, cutoffMonth, cutoffDay, coveredYears.has(selectedYear - 1)),
    withoutIssueDate: rows.filter((row) => row.status !== "DRAFT" && row.openingYear === selectedYear && !row.issueDate).length,
  };
}

export const PARETO_DIMENSIONS = {
  area: "Área",
  origin: "Origen",
  classification: "Clasificación",
} as const;
export type ParetoDimension = keyof typeof PARETO_DIMENSIONS;

export type ParetoItem = DistributionItem & {
  cumulative: number;
  /** Categorías que, acumuladas, llegan al 80 % (incluida la que lo cruza). */
  vitalFew: boolean;
  /** Fila agregada «Otras (n)»: siempre al final, fuera del orden. */
  other?: boolean;
};

export function buildPareto(items: DistributionItem[], maxItems = 10): ParetoItem[] {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (!total) return [];
  const sorted = [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
  const shown: Array<DistributionItem & { other?: boolean }> = sorted.length > maxItems
    ? [
        ...sorted.slice(0, maxItems - 1),
        (() => {
          const rest = sorted.slice(maxItems - 1);
          const count = rest.reduce((sum, item) => sum + item.count, 0);
          return { label: `Otras (${rest.length})`, count, percentage: Math.round((count / total) * 1000) / 10, other: true };
        })(),
      ]
    : sorted;
  let running = 0;
  let reached = false;
  return shown.map((item) => {
    running += item.count;
    const vitalFew = !reached && !item.other;
    if (running / total >= 0.8) reached = true;
    return { ...item, cumulative: Math.round((running / total) * 1000) / 10, vitalFew };
  });
}
