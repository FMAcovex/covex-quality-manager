import type {
  ChangeDistribution,
  ChangeYearMetrics,
} from "@/modules/change-control/analytics/domain";

export const pct = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;

export const num = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("es-ES", { maximumFractionDigits: 1 });

export function ChangeKpiCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: string;
}) {
  return (
    <article className="kpi-card">
      <span className="kpi-title">{title}</span>
      <strong className="kpi-value">{value}</strong>
      {detail ? <span className="kpi-detail">{detail}</span> : null}
    </article>
  );
}

export function ChangeDistributionCard({
  title,
  items,
}: {
  title: string;
  items: ChangeDistribution[];
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="chart-card">
      <h2>{title}</h2>
      <div className="bar-list">
        {items.map((item) => (
          <div className="bar-row" key={item.label}>
            <div className="bar-label">
              <span>{item.label}</span>
              <strong>{item.count} · {pct(item.percentage)}</strong>
            </div>
            <div className="bar-track">
              <span style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function ChangeTrend({ trend }: { trend: ChangeYearMetrics[] }) {
  return (
    <article className="chart-card wide-chart">
      <h2>Resumen anual · últimos 5 años</h2>
      <div className="analytics-table-wrap">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Año</th>
              <th>Total</th>
              <th>Abiertos</th>
              <th>% ejecución en plazo</th>
              <th>Mediana solicitud→ejecución</th>
              <th>Eficacia aceptable</th>
              <th>Pendientes eficacia</th>
              <th>Días ejecución→eficacia</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((item) => (
              <tr key={item.year} className={!item.dataAvailable ? "analytics-no-data" : undefined}>
                <td><strong>{item.year}</strong></td>
                {item.dataAvailable ? (
                  <>
                    <td>{item.total}</td>
                    <td>{item.openCurrent}</td>
                    <td>{pct(item.execution.rate)}</td>
                    <td>{item.execution.medianDays === null ? "—" : `${num(item.execution.medianDays)} d`}</td>
                    <td>{pct(item.effectiveness.rate)}</td>
                    <td>{item.pendingEffectiveness}</td>
                    <td>{item.effectiveness.medianDaysToEffectiveness === null ? "—" : `${num(item.effectiveness.medianDaysToEffectiveness)} d`}</td>
                  </>
                ) : (
                  <td colSpan={7}>Sin datos cargados</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
