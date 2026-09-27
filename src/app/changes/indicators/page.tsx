import Link from "next/link";
import {
  ChangeDistributionCard,
  ChangeKpiCard,
  ChangeTrend,
  num,
  pct,
} from "@/modules/change-control/analytics/components";
import { getChangeAnalytics } from "@/modules/change-control/analytics/queries";

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChangeControlIndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = {
    year: param(query.year),
    department: param(query.department),
    classification: param(query.classification),
    status: param(query.status),
  };
  const data = await getChangeAnalytics(filters);
  const metrics = data.current;

  return (
    <section className="workspace analytics-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sistema de Calidad</p>
          <h1>Controles de Cambios · Indicadores</h1>
          <p>Ejecución, eficacia, estado y tendencia calculados directamente desde PostgreSQL.</p>
        </div>
        <div className="heading-actions">
          <Link href="/changes" className="button">Ver expedientes</Link>
        </div>
      </div>

      <div className="tabs">
        <Link className="tab muted" href="/changes">Expedientes</Link>
        <Link className="tab active" href="/changes/indicators">Indicadores</Link>
      </div>

      <form method="get" className="analytics-filter-panel">
        <label>
          <span>Año</span>
          <select name="year" defaultValue={String(data.selectedYear)}>
            {Array.from(new Set([data.selectedYear, ...data.years]))
              .sort((a, b) => b - a)
              .map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          <span>Departamento</span>
          <select name="department" defaultValue={filters.department ?? ""}>
            <option value="">Todos</option>
            {data.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code} — {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Clasificación</span>
          <select name="classification" defaultValue={filters.classification ?? ""}>
            <option value="">Todas</option>
            <option value="MAJOR">Mayor</option>
            <option value="MINOR">Menor</option>
          </select>
        </label>
        <label>
          <span>Estado final</span>
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            <option value="OPEN">Abiertos</option>
            <option value="CLOSED">Cerrados</option>
          </select>
        </label>
        <div className="analytics-filter-actions">
          <button className="button primary" type="submit">Aplicar</button>
          <Link className="button" href="/changes/indicators">Limpiar</Link>
        </div>
      </form>

      <div className="analytics-note">
        <strong>Criterio:</strong> ejecución en plazo = fecha de ejecución ≤ fecha prevista global del Dictamen.
        La fecha prevista global toma la más tardía entre la fecha de implantación y las acciones del plan.
        La eficacia se evalúa solo cuando existe resultado Aceptable/No aceptable.
      </div>

      <div className="kpi-grid primary-kpis">
        <ChangeKpiCard title="Controles abiertos en el año" value={String(metrics.total)} />
        <ChangeKpiCard title="Abiertos actualmente" value={String(metrics.openCurrent)} />
        <ChangeKpiCard
          title="Ejecución en plazo"
          value={pct(metrics.execution.rate)}
          detail={`${metrics.execution.inTime} de ${metrics.execution.total} evaluables`}
        />
        <ChangeKpiCard
          title="Mediana solicitud→ejecución"
          value={metrics.execution.medianDays === null ? "—" : `${num(metrics.execution.medianDays)} días`}
        />
        <ChangeKpiCard
          title="Ejecutados · eficacia pendiente"
          value={String(metrics.pendingEffectiveness)}
        />
      </div>

      <div className="kpi-grid secondary-kpis">
        <ChangeKpiCard title="Mayores" value={String(metrics.major)} />
        <ChangeKpiCard title="Menores" value={String(metrics.minor)} />
        <ChangeKpiCard
          title="Eficacia aceptable"
          value={pct(metrics.effectiveness.rate)}
          detail={`${metrics.effectiveness.acceptable} de ${metrics.effectiveness.evaluated} evaluados`}
        />
        <ChangeKpiCard
          title="Eficacia no aceptable"
          value={String(metrics.effectiveness.notAcceptable)}
        />
        <ChangeKpiCard
          title="Mediana ejecución→eficacia"
          value={
            metrics.effectiveness.medianDaysToEffectiveness === null
              ? "—"
              : `${num(metrics.effectiveness.medianDaysToEffectiveness)} días`
          }
        />
      </div>

      <div className="analytics-grid">
        <ChangeDistributionCard title="Controles por departamento" items={metrics.departments} />
        <ChangeDistributionCard title="Mayor / Menor" items={metrics.classifications} />
        <ChangeDistributionCard title="Estado de ejecución" items={metrics.executionStates} />
      </div>

      <section className="trend-section">
        <div className="trend-section-heading">
          <div>
            <p className="eyebrow">Tendencia</p>
            <h2>Últimos 5 años hasta {data.selectedYear}</h2>
          </div>
          <p>Los años sin datos permanecen visibles para mantener una escala temporal estable.</p>
        </div>
        <ChangeTrend trend={data.trend} />
      </section>

      <div className="analytics-footnote">
        <strong>Lectura:</strong> los porcentajes deben interpretarse junto con el número absoluto de expedientes y el contexto del cambio.
        El cierre sin ejecución se conserva como excepción documentada y no se contabiliza como ejecución.
      </div>
    </section>
  );
}
