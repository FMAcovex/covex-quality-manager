import type { YearMetrics } from "@/modules/deviations/analytics/domain";

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
