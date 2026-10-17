// Cálculos compartidos de los Indicadores de los módulos: aperturas de 36 meses con media
// móvil, acumulado del año, Pareto y antigüedad de lo abierto. Son descriptivos: sin
// objetivos, límites de control ni plazos del PNT (pendientes de decisión de Calidad).

const DAY_MS = 86_400_000;

export const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] as const;

export function medianOf(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function percentOf(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

/** Días naturales entre dos fechas (UTC, sin hora); null si falta alguna o el intervalo es negativo. */
export function daysFromTo(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const to = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const days = Math.round((to - from) / DAY_MS);
  return days >= 0 ? days : null;
}

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

/** Aperturas por mes (por la fecha indicada) de los últimos `length` meses, con media móvil de 12. */
export function buildMonthlyCounts(
  dates: Array<Date | null>,
  selectedYear: number,
  coveredYears: Set<number>,
  today: Date,
  length = 36,
): MonthlyPoint[] {
  const end = seriesEnd(selectedYear, today);
  const counts = new Map<string, number>();
  for (const date of dates) {
    if (!date) continue;
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
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

export type YearToDateWindow = {
  /** Mismo día y mes en ambos años; 31 de diciembre si el año analizado ya terminó. */
  cutoffMonth: number;
  cutoffDay: number;
  fullYear: boolean;
};

export function yearToDateWindow(selectedYear: number, today: Date): YearToDateWindow {
  const fullYear = selectedYear !== today.getUTCFullYear();
  return {
    cutoffMonth: fullYear ? 11 : today.getUTCMonth(),
    cutoffDay: fullYear ? 31 : today.getUTCDate(),
    fullYear,
  };
}

/** ¿La fecha cae entre el 1 de enero y el día de corte del año dado? */
export function inYearToDate(window: YearToDateWindow, year: number, value: Date | null) {
  if (!value) return false;
  const from = Date.UTC(year, 0, 1);
  // Hasta el final del día de corte; el 29 de febrero se acota al último día del mes.
  const lastDay = Math.min(window.cutoffDay, new Date(Date.UTC(year, window.cutoffMonth + 1, 0)).getUTCDate());
  const to = Date.UTC(year, window.cutoffMonth, lastDay + 1);
  return value.getTime() >= from && value.getTime() < to;
}

export type YearToDateRow = {
  label: string;
  current: number | null;
  previous: number | null;
  format: "count" | "percent" | "days";
};

export type YearToDateComparison = YearToDateWindow & {
  currentYear: number;
  previousYear: number;
  currentAvailable: boolean;
  previousAvailable: boolean;
  rows: YearToDateRow[];
  /** Texto adicional (base de fechas, exclusiones). */
  note?: string;
};

export type DistributionItem = { label: string; count: number; percentage: number };

/** Recuento por etiqueta, de mayor a menor; admite varias etiquetas por expediente. */
export function countLabels(labels: string[]): DistributionItem[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, percentage: labels.length ? Math.round((count / labels.length) * 1000) / 10 : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

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

// Antigüedad de lo abierto hoy. Tramos descriptivos: no son plazos del PNT ni objetivos.
export const AGING_BUCKETS = [
  { key: "0-30", label: "0–30 días", max: 30 },
  { key: "31-60", label: "31–60 días", max: 60 },
  { key: "61-90", label: "61–90 días", max: 90 },
  { key: "90+", label: "Más de 90 días", max: Number.POSITIVE_INFINITY },
] as const;

export type AgingRow = {
  id: string;
  code: string;
  /** Fecha desde la que se cuenta la antigüedad (apertura, solicitud, comunicación…). */
  startDate: Date | null;
  /** Marcas que el panel cuenta por tramo (p. ej. CRITICAL, OVERDUE). */
  tags: string[];
  /** Texto breve junto a las más antiguas (p. ej. «Crítica»). */
  note?: string | null;
};

export type AgingSummary = {
  total: number;
  withoutStartDate: number;
  medianAgeDays: number | null;
  buckets: Array<{ key: string; label: string; count: number; percentage: number; tags: Record<string, number> }>;
  oldest: Array<{ id: string; code: string; ageDays: number; note: string | null }>;
};

/** Días naturales desde la fecha de inicio hasta hoy (fechas UTC sin hora). */
export function ageInDays(startDate: Date, today: Date) {
  return Math.max(0, daysFromTo(startDate, today) ?? 0);
}

export function buildAging(rows: AgingRow[], today: Date, oldestLimit = 5): AgingSummary {
  const aged = rows
    .filter((row) => row.startDate)
    .map((row) => ({ ...row, ageDays: ageInDays(row.startDate!, today) }));
  const buckets = AGING_BUCKETS.map((bucket, index) => {
    const min = index === 0 ? 0 : AGING_BUCKETS[index - 1].max + 1;
    const inBucket = aged.filter((row) => row.ageDays >= min && row.ageDays <= bucket.max);
    const tags: Record<string, number> = {};
    for (const row of inBucket) for (const tag of row.tags) tags[tag] = (tags[tag] ?? 0) + 1;
    return {
      key: bucket.key,
      label: bucket.label,
      count: inBucket.length,
      percentage: aged.length ? Math.round((inBucket.length / aged.length) * 1000) / 10 : 0,
      tags,
    };
  });
  return {
    total: rows.length,
    withoutStartDate: rows.length - aged.length,
    medianAgeDays: medianOf(aged.map((row) => row.ageDays)),
    buckets,
    oldest: [...aged]
      .sort((a, b) => b.ageDays - a.ageDays || a.code.localeCompare(b.code, "es"))
      .slice(0, oldestLimit)
      .map(({ id, code, ageDays, note }) => ({ id, code, ageDays, note: note ?? null })),
  };
}

/** Inicio del día de hoy (UTC) para comparar fechas sin hora. */
export function startOfUtcDay(today: Date) {
  return Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
}

/** Fecha vencida: hoy o antes (`inclusive`) o estrictamente antes de hoy. */
export function isDue(date: Date | null, today: Date, inclusive = true) {
  if (!date) return false;
  const value = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return inclusive ? value <= startOfUtcDay(today) : value < startOfUtcDay(today);
}

/** Parámetro `pareto` validado contra las dimensiones de la página. */
export function paretoDimension<K extends string>(value: string | undefined, keys: readonly K[], fallback: K): K {
  return value && (keys as readonly string[]).includes(value) ? (value as K) : fallback;
}

/** Enlace a la página de indicadores conservando los filtros; añade `pareto` y el ancla. */
export function indicatorsHref(base: string, filters: Record<string, string | undefined>, pareto: string, defaultPareto: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (pareto !== defaultPareto) params.set("pareto", pareto);
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}#pareto`;
}
