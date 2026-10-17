import Link from "next/link";
import {
  MONTH_LABELS,
  type AgingSummary,
  type MonthlyPoint,
  type ParetoItem,
  type YearToDateComparison,
} from "@/lib/qms/analytics/trends";

// Piezas comunes de las pestañas Indicadores (Desviaciones, CAPA, Cambios, Reclamaciones,
// Devoluciones). Se renderizan en servidor; el detalle por mes va en <title> y en tabla.

const formatNumber = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const formatPercent = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

/** Escala del eje Y con 3–5 marcas redondas. */
function niceScale(max: number) {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((candidate) => max / candidate <= 4) ?? Math.ceil(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) };
}

const monthName = (point: Pick<MonthlyPoint, "year" | "month">) => `${MONTH_LABELS[point.month]} ${point.year}`;

export type Noun = { one: string; many: string };
const countLabel = (value: number, noun: Noun) => `${value} ${value === 1 ? noun.one : noun.many}`;

/**
 * Aperturas de los últimos 36 meses con la media móvil de 12 meses.
 * Barras y media comparten unidad (expedientes/mes), así que van en un único eje.
 */
export function MonthlyTrendChart({
  series,
  noun = { one: "apertura", many: "aperturas" },
  basis = "Por fecha de apertura.",
}: {
  series: MonthlyPoint[];
  noun?: Noun;
  /** Fecha que cuenta para el mes (apertura, solicitud, comunicación…). */
  basis?: string;
}) {
  const width = 1200;
  const height = 300;
  const left = 36;
  const right = 48;
  const top = 14;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const slot = plotWidth / series.length;
  const barWidth = Math.min(14, slot * 0.6);
  const values = series.flatMap((point) => [point.count ?? 0, point.rolling12 ?? 0]);
  const { top: yTop, ticks } = niceScale(Math.max(1, ...values));
  const y = (value: number) => top + plotHeight - (value / yTop) * plotHeight;
  const x = (index: number) => left + slot * index + slot / 2;
  const first = series[0];
  const last = series[series.length - 1];
  const lastAverage = [...series].reverse().find((point) => point.rolling12 !== null);
  const lastAverageIndex = lastAverage ? series.indexOf(lastAverage) : -1;
  // Tramos continuos de la media (se corta en los meses sin datos).
  const lines: string[][] = [];
  series.forEach((point, index) => {
    if (point.rolling12 === null) return;
    const previous = series[index - 1];
    if (!previous || previous.rolling12 === null) lines.push([]);
    lines[lines.length - 1].push(`${x(index).toFixed(1)},${y(point.rolling12).toFixed(1)}`);
  });
  // Bandas de años sin datos cargados: se ven como hueco, nunca como cero.
  const gaps: Array<{ start: number; end: number }> = [];
  series.forEach((point, index) => {
    if (point.count !== null) return;
    const gap = gaps[gaps.length - 1];
    if (gap && gap.end === index - 1) gap.end = index;
    else gaps.push({ start: index, end: index });
  });
  const covered = series.filter((point) => point.count !== null);
  const summary = lastAverage
    ? `Media de 12 meses hasta ${monthName(lastAverage)}: ${formatNumber(lastAverage.rolling12)} ${noun.many} al mes.`
    : "Sin 12 meses completos con datos para calcular la media móvil.";
  const capitalized = noun.many.charAt(0).toUpperCase() + noun.many.slice(1);

  return (
    <article className="chart-card wide-chart r12-card">
      <div className="chart-heading">
        <div>
          <h2>{capitalized} por mes · últimos 36 meses</h2>
          <p>{monthName(first)} – {monthName(last)}. {summary}</p>
        </div>
        <div className="chart-legend">
          <span><i className="legend-r12-bar" />{capitalized} del mes</span>
          <span><i className="legend-r12-line" />Media móvil 12 meses</span>
          {last.partial ? <span><i className="legend-r12-partial" />Mes en curso (parcial)</span> : null}
        </div>
      </div>
      <div className="r12-chart-wrap">
        <svg className="r12-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${capitalized} mensuales de ${monthName(first)} a ${monthName(last)} con media móvil de 12 meses. ${summary}`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} className={tick ? "r12-grid" : "r12-baseline"} />
              <text x={left - 6} y={y(tick) + 3.5} textAnchor="end" className="r12-tick">{tick}</text>
            </g>
          ))}
          {gaps.map((gap) => (
            <g key={gap.start}>
              <rect x={left + slot * gap.start} y={top} width={slot * (gap.end - gap.start + 1)} height={plotHeight} className="r12-gap" />
              <text x={left + slot * ((gap.start + gap.end + 1) / 2)} y={top + plotHeight / 2} textAnchor="middle" className="r12-gap-label">Sin datos cargados</text>
            </g>
          ))}
          {series.map((point, index) => point.month === 0 && index > 0 ? (
            <line key={`sep-${point.year}`} x1={left + slot * index} x2={left + slot * index} y1={top} y2={top + plotHeight + 26} className="r12-year-sep" />
          ) : null)}
          {series.map((point, index) => point.count ? (
            <rect
              key={`bar-${index}`}
              x={x(index) - barWidth / 2}
              y={y(point.count)}
              width={barWidth}
              height={Math.max(1, top + plotHeight - y(point.count))}
              rx={Math.min(3, barWidth / 3)}
              className={point.partial ? "r12-bar partial" : "r12-bar"}
            />
          ) : null)}
          {lines.map((points, index) => <polyline key={index} points={points.join(" ")} className="r12-line" />)}
          {lastAverage && lastAverageIndex >= 0 ? <>
            <circle cx={x(lastAverageIndex)} cy={y(lastAverage.rolling12!)} r="4" className="r12-end" />
            <text x={x(lastAverageIndex) + 8} y={y(lastAverage.rolling12!) + 4} className="r12-end-label">{formatNumber(lastAverage.rolling12)}</text>
          </> : null}
          {series.map((point, index) => (
            <g key={`label-${index}`}>
              {point.month % 3 === 0 ? <text x={x(index)} y={top + plotHeight + 15} textAnchor="middle" className="r12-month">{MONTH_LABELS[point.month]}</text> : null}
              {/* El año inicial solo se rotula si hay sitio antes del primer enero. */}
              {point.month === 0 || (index === 0 && point.month <= 9) ? <text x={left + slot * index + 4} y={top + plotHeight + 31} className="r12-year">{point.year}</text> : null}
            </g>
          ))}
          {series.map((point, index) => (
            <rect key={`hit-${index}`} x={left + slot * index} y={top} width={slot} height={plotHeight} className="r12-hit">
              <title>{`${monthName(point)}${point.partial ? " (en curso)" : ""}: ${point.count === null ? "sin datos cargados" : countLabel(point.count, noun)}${point.rolling12 === null ? "" : ` · media 12 meses: ${formatNumber(point.rolling12)}`}`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <details className="r12-data">
        <summary>Ver datos en tabla</summary>
        <div className="analytics-table-wrap">
          <table className="backlog-table">
            <thead><tr><th>Mes</th><th>{capitalized}</th><th>Media 12 meses</th></tr></thead>
            <tbody>{[...series].reverse().map((point) => (
              <tr key={`${point.year}-${point.month}`}>
                <th scope="row">{monthName(point)}{point.partial ? " (en curso)" : ""}</th>
                <td>{point.count === null ? "Sin datos" : point.count}</td>
                <td>{formatNumber(point.rolling12)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <p className="muted-note r12-note">
        {basis} La media móvil suaviza la estacionalidad: cada punto es la media de los 12 meses que terminan en ese mes y solo se calcula con 12 meses completos y con datos.
        {covered.length < series.length ? " Los años sin datos cargados aparecen como hueco, no como cero." : ""}
      </p>
    </article>
  );
}

function signedDelta(current: number | null, previous: number | null, suffix = "") {
  if (current === null || previous === null) return "—";
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return "=";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("es-ES", { maximumFractionDigits: 1 })}${suffix}`;
}

const formatYtd = (value: number | null, format: YearToDateComparison["rows"][number]["format"]) =>
  format === "percent" ? formatPercent(value) : format === "days" ? (value === null ? "—" : `${formatNumber(value)} d`) : formatNumber(value);
const deltaSuffix = { count: "", percent: " pp", days: " d" } as const;

/** Acumulado del año frente al mismo periodo del año anterior (mismo día de corte). */
export function YearToDateCard({ ytd }: { ytd: YearToDateComparison }) {
  const period = (year: number) => ytd.fullYear ? `${year} completo` : `1 ene – ${ytd.cutoffDay} ${MONTH_LABELS[ytd.cutoffMonth].toLowerCase()} ${year}`;
  const show = (value: number | null, available: boolean, format: YearToDateComparison["rows"][number]["format"]) =>
    available ? formatYtd(value, format) : "Sin datos";
  return (
    <article className="chart-card ytd-card">
      <div className="chart-heading">
        <div>
          <h2>{ytd.fullYear ? "Año completo frente al anterior" : "Acumulado del año"}</h2>
          <p>{period(ytd.currentYear)} frente a {period(ytd.previousYear)}</p>
        </div>
      </div>
      <table className="backlog-table ytd-table">
        <thead><tr><th>Indicador</th><th>{ytd.currentYear}</th><th>{ytd.previousYear}</th><th>Variación</th></tr></thead>
        <tbody>{ytd.rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td><strong>{show(row.current, ytd.currentAvailable, row.format)}</strong></td>
            <td>{show(row.previous, ytd.previousAvailable, row.format)}</td>
            <td>{ytd.currentAvailable && ytd.previousAvailable ? signedDelta(row.current, row.previous, deltaSuffix[row.format]) : "—"}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="muted-note">
        {ytd.fullYear
          ? "El año analizado ya terminó: se compara el año completo."
          : "Compara el mismo número de días de ambos años, así el año en curso no se mide contra un año entero."}
        {ytd.note ? ` ${ytd.note}` : ""} Sin objetivo aprobado: la variación es descriptiva.
      </p>
    </article>
  );
}

export type ParetoDimensionView = {
  key: string;
  label: string;
  items: ParetoItem[];
  /** Qué se cuenta: aperturas, o menciones cuando un expediente admite varias categorías. */
  unit?: string;
  note?: string;
};

/**
 * Pareto del año analizado: categorías ordenadas de mayor a menor con el porcentaje acumulado
 * como texto (sin segundo eje). Las que suman el 80 % de los casos van resaltadas.
 */
export function ParetoCard({
  year,
  dimensions,
  active,
  hrefFor,
  unit: defaultUnit = "aperturas",
}: {
  year: number;
  dimensions: ParetoDimensionView[];
  active: string;
  hrefFor: (dimension: string) => string;
  /** Qué cuentan las dimensiones que no indican la suya (p. ej. «reclamaciones»). */
  unit?: string;
}) {
  const dimension = dimensions.find((item) => item.key === active) ?? dimensions[0];
  const items = dimension.items;
  const max = Math.max(1, ...items.map((item) => item.count));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const vitalCount = items.filter((item) => item.vitalFew).length;
  const lastVital = items.findLastIndex((item) => item.vitalFew);
  const unit = dimension.unit ?? defaultUnit;
  return (
    <article className="chart-card pareto-card" id="pareto">
      <div className="chart-heading">
        <div>
          <h2>Pareto por {dimension.label.toLowerCase()} · {year}</h2>
          <p>{total ? `${vitalCount} de ${items.length} categorías concentran el 80 % de las ${total} ${unit}.` : "Sin datos en el año con estos filtros."}</p>
        </div>
      </div>
      <nav className="pareto-switch" aria-label="Agrupar Pareto por">
        {dimensions.map((item) => (
          <Link key={item.key} href={hrefFor(item.key)} className={item.key === dimension.key ? "active" : undefined} aria-current={item.key === dimension.key ? "true" : undefined}>{item.label}</Link>
        ))}
      </nav>
      {items.length ? (
        <ol className="pareto-list">
          <li className="pareto-head" aria-hidden="true"><span>{dimension.label}</span><span>Casos</span><span>%</span><span>Acum.</span></li>
          {items.map((item, index) => (
            <li key={item.label} className={`pareto-row${item.vitalFew ? " vital" : ""}${index === lastVital && index < items.length - 1 ? " cut" : ""}`}>
              <div className="pareto-label">
                <span title={item.label}>{item.label}</span>
                <div className="bar-track" aria-hidden="true"><span style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }} /></div>
              </div>
              <strong>{item.count}</strong>
              <span>{formatPercent(item.percentage)}</span>
              <span className="pareto-cumulative">{formatPercent(item.cumulative)}</span>
            </li>
          ))}
        </ol>
      ) : <div className="empty-panel">Sin datos para el periodo.</div>}
      {items.length ? <p className="muted-note">
        Resaltadas: las categorías que, acumuladas, alcanzan el 80 % de los casos (la línea marca el corte). Es una ayuda para priorizar, no una conclusión de causa raíz.
        {dimension.note ? ` ${dimension.note}` : ""}
      </p> : null}
    </article>
  );
}

export type AgingColumn = { key: string; label: string; alert?: boolean };
export type AgingCounter = { value: number; label: string; alert?: boolean };

/** Antigüedad de lo abierto hoy por tramos, con contadores del módulo y las más antiguas. */
export function AgingPanel({
  id,
  eyebrow = "Pendientes hoy",
  title,
  description,
  summary,
  columns,
  counters,
  totalLabel = "abiertas",
  listHref,
  listLabel,
  detailHref,
  emptyText,
  noDateText,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  summary: AgingSummary;
  columns: AgingColumn[];
  counters: AgingCounter[];
  totalLabel?: string;
  listHref?: string;
  listLabel?: string;
  detailHref: (id: string) => string;
  emptyText: string;
  noDateText: string;
}) {
  const dated = summary.total - summary.withoutStartDate;
  return (
    <section className="chart-card backlog-card" aria-labelledby={id}>
      <div className="backlog-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={id}>{title}</h2>
          <p className="muted-note">{description}</p>
        </div>
        {listHref ? <Link className="summary-link" href={listHref}>{listLabel} →</Link> : null}
      </div>
      <p className="list-counters backlog-counters">
        <span><strong>{summary.total}</strong> {totalLabel}</span>
        <span><strong>{summary.medianAgeDays === null ? "—" : formatNumber(summary.medianAgeDays)}</strong> días de mediana</span>
        {counters.map((counter) => (
          <span key={counter.label} className={counter.alert && counter.value ? "backlog-alert" : ""}><strong>{counter.value}</strong> {counter.label}</span>
        ))}
        {summary.withoutStartDate ? <span className="backlog-alert"><strong>{summary.withoutStartDate}</strong> sin fecha de inicio</span> : null}
      </p>
      {dated ? <>
        <div className="backlog-bar" role="img" aria-label={summary.buckets.map((bucket) => `${bucket.label}: ${bucket.count}`).join(", ")}>
          {summary.buckets.filter((bucket) => bucket.count).map((bucket) => (
            <span key={bucket.key} className={`backlog-segment backlog-${bucket.key}`} style={{ flexGrow: bucket.count }} title={`${bucket.label}: ${bucket.count}`}>{bucket.count}</span>
          ))}
        </div>
        <div className="backlog-columns">
          <div className="backlog-table-wrap"><table className="backlog-table">
            <thead><tr><th>Antigüedad</th><th>Total</th><th>%</th>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>{summary.buckets.map((bucket) => (
              <tr key={bucket.key}>
                <th scope="row"><span className={`backlog-dot backlog-${bucket.key}`} aria-hidden="true" />{bucket.label}</th>
                <td>{bucket.count}</td>
                <td>{formatPercent(bucket.percentage)}</td>
                {columns.map((column) => {
                  const value = bucket.tags[column.key] ?? 0;
                  return <td key={column.key} className={column.alert && value ? "backlog-alert" : ""}>{value}</td>;
                })}
              </tr>
            ))}</tbody>
          </table></div>
          <div>
            <h3>Las más antiguas</h3>
            <ol className="backlog-oldest">{summary.oldest.map((item) => (
              <li key={item.id}>
                <Link className="summary-link" href={detailHref(item.id)}>{item.code}</Link>
                <span>{item.ageDays} días{item.note ? ` · ${item.note}` : ""}</span>
              </li>
            ))}</ol>
          </div>
        </div>
      </> : <div className="empty-panel">{summary.total ? noDateText : emptyText}</div>}
    </section>
  );
}
