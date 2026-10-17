import Link from "next/link";
import {
  MONTH_LABELS,
  PARETO_DIMENSIONS,
  type DeviationBacklog,
  type MonthlyPoint,
  type ParetoDimension,
  type ParetoItem,
  type YearMetrics,
  type YearToDate,
} from "@/modules/deviations/analytics/domain";

export function formatPercent(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
}

export function formatNumber(value: number | null) {
  return value === null ? "—" : value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
}

export function deltaLabel(current: number | null, previous: number | null, suffix = "") {
  if (current === null || previous === null) return "Sin comparación";
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return `= ${previous.toLocaleString("es-ES")}${suffix}`;
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString("es-ES")}${suffix} vs. año anterior`;
}

export function KpiCard({
  title,
  value,
  detail,
  comparison,
  caution,
}: {
  title: string;
  value: string;
  detail?: string;
  comparison?: string;
  caution?: boolean;
}) {
  return (
    <article className={`kpi-card${caution ? " caution" : ""}`}>
      <span className="kpi-title">{title}</span>
      <strong className="kpi-value">{value}</strong>
      {detail ? <span className="kpi-detail">{detail}</span> : null}
      {comparison ? <span className="kpi-comparison">{comparison}</span> : null}
    </article>
  );
}

function pointValue(metric: "total" | "closure" | "recurrence" | "median", item: YearMetrics) {
  if (!item.dataAvailable) return null;
  if (metric === "total") return item.total;
  if (metric === "closure") return item.closure.rate;
  if (metric === "recurrence") return item.recurrence.rate;
  return item.closure.medianDays;
}

export function TrendChart({
  title,
  trend,
  metric,
  suffix = "",
}: {
  title: string;
  trend: YearMetrics[];
  metric: "total" | "closure" | "recurrence" | "median";
  suffix?: string;
}) {
  const values = trend.map((item) => pointValue(metric, item));
  const available = values.filter((value): value is number => value !== null);
  const max = Math.max(1, ...available);
  const min = Math.min(0, ...available);
  const range = Math.max(1, max - min);
  const points = trend.map((item, index) => {
    const value = values[index];
    if (value === null) return null;
    const x = 8 + (index / Math.max(1, trend.length - 1)) * 84;
    const y = 88 - ((value - min) / range) * 72;
    return { x, y, value, year: item.year };
  });
  const segments = points
    .map((point, index) => {
      if (!point) return null;
      const next = points[index + 1];
      if (!next) return null;
      return `${point.x},${point.y} ${next.x},${next.y}`;
    })
    .filter((value): value is string => Boolean(value));

  return (
    <article className="trend-card">
      <h3>{title}</h3>
      <svg viewBox="0 0 100 100" role="img" aria-label={`Tendencia de ${title}`}>
        <line x1="8" y1="88" x2="92" y2="88" className="trend-axis" />
        {segments.map((segment, index) => {
          const [a, b] = segment.split(" ");
          const [x1, y1] = a.split(",");
          const [x2, y2] = b.split(",");
          return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} className="trend-line" />;
        })}
        {points.map((point, index) => point ? (
          <g key={point.year}>
            <circle cx={point.x} cy={point.y} r="2.4" className="trend-dot" />
            <text x={point.x} y={Math.max(8, point.y - 5)} textAnchor="middle" className="trend-value">
              {point.value.toLocaleString("es-ES", { maximumFractionDigits: 1 })}{suffix}
            </text>
            <text x={point.x} y="98" textAnchor="middle" className="trend-year">{point.year}</text>
          </g>
        ) : (
          <g key={trend[index].year}>
            <text x={8 + (index / Math.max(1, trend.length - 1)) * 84} y="50" textAnchor="middle" className="trend-no-data">s/d</text>
            <text x={8 + (index / Math.max(1, trend.length - 1)) * 84} y="98" textAnchor="middle" className="trend-year">
              {trend[index].year}
            </text>
          </g>
        ))}
      </svg>
    </article>
  );
}

export function AnnualSummaryTable({ trend }: { trend: YearMetrics[] }) {
  return (
    <article className="chart-card wide-chart">
      <h2>Resumen anual · últimos 5 años</h2>
      <div className="analytics-table-wrap">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Año</th><th>Total</th><th>% ≤30 d</th><th>Mediana</th><th>% recurrentes</th>
              <th>% afecta PT</th><th>Críticas</th><th>Mayores</th><th>% CAPA</th><th>% completitud KPI</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((item) => (
              <tr key={item.year} className={!item.dataAvailable ? "analytics-no-data" : undefined}>
                <td><strong>{item.year}</strong></td>
                {item.dataAvailable ? (
                  <>
                    <td>{item.total}</td>
                    <td>{formatPercent(item.closure.rate)}</td>
                    <td>{item.closure.medianDays === null ? "—" : `${formatNumber(item.closure.medianDays)} d`}</td>
                    <td>{formatPercent(item.recurrence.rate)}</td>
                    <td>{formatPercent(item.affectsProduct.rate)}</td>
                    <td>{item.critical}</td>
                    <td>{item.major}</td>
                    <td>{formatPercent(item.withCapaRate)}</td>
                    <td>{formatPercent(item.data.completeness)}</td>
                  </>
                ) : (
                  <td colSpan={9}>Sin datos cargados en PostgreSQL</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

const classificationLabel = { CRITICAL: "Crítica", MAJOR: "Mayor", MINOR: "Menor" } as const;

/** Antigüedad de las desviaciones abiertas hoy (piloto de indicadores de pendientes). */
export function BacklogPanel({ backlog }: { backlog: DeviationBacklog }) {
  const dated = backlog.total - backlog.withoutIssueDate;
  return (
    <section className="chart-card backlog-card" aria-labelledby="backlog-title">
      <div className="backlog-heading">
        <div>
          <p className="eyebrow">Pendientes hoy</p>
          <h2 id="backlog-title">Antigüedad de las desviaciones abiertas</h2>
          <p className="muted-note">Abiertas a fecha de hoy, sea cual sea su año de apertura. Días naturales desde la fecha de apertura. Los tramos son descriptivos, no plazos del PNT.</p>
        </div>
        <Link className="summary-link" href="/deviations?status=OPEN">Ver abiertas en el listado →</Link>
      </div>
      <p className="list-counters backlog-counters">
        <span><strong>{backlog.total}</strong> abiertas</span>
        <span><strong>{backlog.medianAgeDays === null ? "—" : formatNumber(backlog.medianAgeDays)}</strong> días de mediana</span>
        <span className={backlog.outOfTime ? "backlog-alert" : ""}><strong>{backlog.outOfTime}</strong> marcadas fuera de plazo</span>
        <span className={backlog.followupDue ? "backlog-alert" : ""}><strong>{backlog.followupDue}</strong> con seguimiento vencido</span>
        {backlog.withoutIssueDate ? <span className="backlog-alert"><strong>{backlog.withoutIssueDate}</strong> sin fecha de apertura</span> : null}
      </p>
      {dated ? <>
        <div className="backlog-bar" role="img" aria-label={backlog.buckets.map((bucket) => `${bucket.label}: ${bucket.count}`).join(", ")}>
          {backlog.buckets.filter((bucket) => bucket.count).map((bucket) => (
            <span key={bucket.key} className={`backlog-segment backlog-${bucket.key}`} style={{ flexGrow: bucket.count }} title={`${bucket.label}: ${bucket.count}`}>{bucket.count}</span>
          ))}
        </div>
        <div className="backlog-columns">
          <div className="backlog-table-wrap"><table className="backlog-table">
            <thead><tr><th>Antigüedad</th><th>Abiertas</th><th>%</th><th>Críticas</th><th>Mayores</th></tr></thead>
            <tbody>{backlog.buckets.map((bucket) => (
              <tr key={bucket.key}>
                <th scope="row"><span className={`backlog-dot backlog-${bucket.key}`} aria-hidden="true" />{bucket.label}</th>
                <td>{bucket.count}</td>
                <td>{formatPercent(bucket.percentage)}</td>
                <td className={bucket.critical ? "backlog-alert" : ""}>{bucket.critical}</td>
                <td>{bucket.major}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <div>
            <h3>Las más antiguas</h3>
            <ol className="backlog-oldest">{backlog.oldest.map((item) => (
              <li key={item.id}>
                <Link className="summary-link" href={`/deviations/${item.id}`}>{item.code}</Link>
                <span>{item.ageDays} días{item.classification ? ` · ${classificationLabel[item.classification]}` : ""}</span>
              </li>
            ))}</ol>
          </div>
        </div>
      </> : <div className="empty-panel">{backlog.total ? "Las desviaciones abiertas no tienen fecha de apertura." : "No hay desviaciones abiertas con estos filtros."}</div>}
    </section>
  );
}


/** Escala del eje Y con 3–5 marcas redondas. */
function niceScale(max: number) {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((candidate) => max / candidate <= 4) ?? Math.ceil(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) };
}

const monthName = (point: Pick<MonthlyPoint, "year" | "month">) => `${MONTH_LABELS[point.month]} ${point.year}`;

/**
 * Aperturas de los últimos 36 meses con la media móvil de 12 meses (piloto de tendencias).
 * Barras y media comparten unidad (desviaciones/mes), así que van en un único eje.
 */
export function MonthlyTrendChart({ series }: { series: MonthlyPoint[] }) {
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
    ? `Media de 12 meses hasta ${monthName(lastAverage)}: ${formatNumber(lastAverage.rolling12)} aperturas al mes.`
    : "Sin 12 meses completos con datos para calcular la media móvil.";

  return (
    <article className="chart-card wide-chart r12-card">
      <div className="chart-heading">
        <div>
          <h2>Aperturas por mes · últimos 36 meses</h2>
          <p>{monthName(first)} – {monthName(last)}. {summary}</p>
        </div>
        <div className="chart-legend">
          <span><i className="legend-r12-bar" />Aperturas del mes</span>
          <span><i className="legend-r12-line" />Media móvil 12 meses</span>
          {last.partial ? <span><i className="legend-r12-partial" />Mes en curso (parcial)</span> : null}
        </div>
      </div>
      <div className="r12-chart-wrap">
        <svg className="r12-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Aperturas mensuales de ${monthName(first)} a ${monthName(last)} con media móvil de 12 meses. ${summary}`}>
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
              <title>{`${monthName(point)}${point.partial ? " (en curso)" : ""}: ${point.count === null ? "sin datos cargados" : `${point.count} ${point.count === 1 ? "apertura" : "aperturas"}`}${point.rolling12 === null ? "" : ` · media 12 meses: ${formatNumber(point.rolling12)}`}`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <details className="r12-data">
        <summary>Ver datos en tabla</summary>
        <div className="analytics-table-wrap">
          <table className="backlog-table">
            <thead><tr><th>Mes</th><th>Aperturas</th><th>Media 12 meses</th></tr></thead>
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
        Por fecha de apertura. La media móvil suaviza la estacionalidad: cada punto es la media de los 12 meses que terminan en ese mes y solo se calcula con 12 meses completos y con datos.
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

/** Acumulado del año frente al mismo periodo del año anterior (mismo día de corte). */
export function YearToDateCard({ ytd }: { ytd: YearToDate }) {
  const period = (year: number) => ytd.fullYear ? `${year} completo` : `1 ene – ${ytd.cutoffDay} ${MONTH_LABELS[ytd.cutoffMonth].toLowerCase()} ${year}`;
  const { current, previous } = ytd;
  const rows: Array<{ label: string; current: number | null; previous: number | null; format?: (value: number | null) => string; suffix?: string }> = [
    { label: "Aperturas", current: current.openings, previous: previous.openings },
    { label: "Críticas", current: current.critical, previous: previous.critical },
    { label: "Mayores", current: current.major, previous: previous.major },
    { label: "Cierres", current: current.closures, previous: previous.closures },
    { label: "Cierre en ≤30 días", current: current.closureRate, previous: previous.closureRate, format: formatPercent, suffix: " pp" },
  ];
  const show = (value: number | null, available: boolean, format?: (value: number | null) => string) =>
    !available ? "Sin datos" : format ? format(value) : formatNumber(value);
  return (
    <article className="chart-card ytd-card">
      <div className="chart-heading">
        <div>
          <h2>{ytd.fullYear ? "Año completo frente al anterior" : "Acumulado del año"}</h2>
          <p>{period(current.year)} frente a {period(previous.year)}</p>
        </div>
      </div>
      <table className="backlog-table ytd-table">
        <thead><tr><th>Indicador</th><th>{current.year}</th><th>{previous.year}</th><th>Variación</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td><strong>{show(row.current, current.dataAvailable, row.format)}</strong></td>
            <td>{show(row.previous, previous.dataAvailable, row.format)}</td>
            <td>{current.dataAvailable && previous.dataAvailable ? signedDelta(row.current, row.previous, row.suffix) : "—"}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="muted-note">
        {ytd.fullYear
          ? "El año analizado ya terminó: se compara el año completo."
          : "Compara el mismo número de días de ambos años, así el año en curso no se mide contra un año entero."}
        {" "}Aperturas por fecha de apertura; cierres por fecha de cierre. Sin objetivo aprobado: la variación es descriptiva.
        {ytd.withoutIssueDate ? ` ${ytd.withoutIssueDate} del año sin fecha de apertura no entran en el acumulado.` : ""}
      </p>
    </article>
  );
}

/**
 * Pareto del año analizado: categorías ordenadas de mayor a menor con el porcentaje acumulado
 * como texto (sin segundo eje). Las que suman el 80 % de los casos van resaltadas.
 */
export function ParetoCard({
  year,
  dimension,
  items,
  hrefFor,
}: {
  year: number;
  dimension: ParetoDimension;
  items: ParetoItem[];
  hrefFor: (dimension: ParetoDimension) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const vitalCount = items.filter((item) => item.vitalFew).length;
  const lastVital = items.findLastIndex((item) => item.vitalFew);
  return (
    <article className="chart-card pareto-card" id="pareto">
      <div className="chart-heading">
        <div>
          <h2>Pareto por {PARETO_DIMENSIONS[dimension].toLowerCase()} · {year}</h2>
          <p>{total ? `${vitalCount} de ${items.length} categorías concentran el 80 % de las ${total} aperturas.` : "Sin aperturas en el año con estos filtros."}</p>
        </div>
      </div>
      <nav className="pareto-switch" aria-label="Agrupar Pareto por">
        {(Object.keys(PARETO_DIMENSIONS) as ParetoDimension[]).map((key) => (
          <Link key={key} href={hrefFor(key)} className={key === dimension ? "active" : undefined} aria-current={key === dimension ? "true" : undefined}>{PARETO_DIMENSIONS[key]}</Link>
        ))}
      </nav>
      {items.length ? (
        <ol className="pareto-list">
          <li className="pareto-head" aria-hidden="true"><span>{PARETO_DIMENSIONS[dimension]}</span><span>Casos</span><span>%</span><span>Acum.</span></li>
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
      {items.length ? <p className="muted-note">Resaltadas: las categorías que, acumuladas, alcanzan el 80 % de los casos (la línea marca el corte). Es una ayuda para priorizar, no una conclusión de causa raíz.</p> : null}
    </article>
  );
}
