import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { AgingPanel, MonthlyTrendChart, ParetoCard, YearToDateCard } from "@/components/analytics/trend-charts";
import { indicatorsHref, paretoDimension } from "@/lib/qms/analytics/trends";
import {
  ChangeKpiCard,
  ChangeTrend,
  num,
  pct,
} from "@/modules/change-control/analytics/components";
import { CHANGE_PARETO, type ChangeParetoDimension } from "@/modules/change-control/analytics/domain";
import { getChangeAnalytics, getChangeBacklog } from "@/modules/change-control/analytics/queries";

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function ChangeControlIndicatorsPageAuthenticatedContent({
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
  const [data, backlog] = await Promise.all([getChangeAnalytics(filters), getChangeBacklog(filters)]);
  const metrics = data.current;
  const paretoKeys = Object.keys(CHANGE_PARETO) as ChangeParetoDimension[];
  const paretoActive = paretoDimension(param(query.pareto), paretoKeys, "department");
  const paretoHref = (key: string) =>
    indicatorsHref("/changes/indicators", { ...filters, year: String(data.selectedYear) }, key, "department");

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
        {paretoActive !== "department" ? <input type="hidden" name="pareto" value={paretoActive} /> : null}
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

      <AgingPanel
        id="change-backlog-title"
        title="Antigüedad de los controles de cambios abiertos"
        description="Abiertos a fecha de hoy, sea cual sea su año. Días naturales desde la fecha de solicitud. «Prevista superada»: sin ejecutar y la fecha prevista global del Dictamen ya pasó. Los tramos son descriptivos, no plazos del PNT."
        summary={backlog}
        columns={[
          { key: "MAJOR", label: "Mayores" },
          { key: "OVERDUE", label: "Prevista superada", alert: true },
          { key: "EFFECTIVENESS", label: "Eficacia pendiente" },
        ]}
        counters={[
          { value: backlog.overdue, label: "sin ejecutar con fecha prevista superada", alert: true },
          { value: backlog.followupDue, label: "con seguimiento vencido", alert: true },
          { value: backlog.pendingEffectiveness, label: "ejecutados con eficacia pendiente" },
        ]}
        totalLabel="abiertos"
        listHref="/changes?status=OPEN"
        listLabel="Ver abiertos en el listado"
        detailHref={(id) => `/changes/${id}`}
        emptyText="No hay controles de cambios abiertos con estos filtros."
        noDateText="Los controles abiertos no tienen fecha de solicitud."
      />

      <div className="analytics-grid">
        <MonthlyTrendChart series={data.monthlySeries} noun={{ one: "solicitud", many: "solicitudes" }} basis="Por fecha de solicitud." />
        <YearToDateCard ytd={data.yearToDate} />
        <ParetoCard
          year={data.selectedYear}
          dimensions={paretoKeys.map((key) => ({
            key,
            label: CHANGE_PARETO[key],
            items: data.pareto[key],
            ...(key === "scope" ? { unit: "menciones", note: "Un control puede afectar a varios alcances: el porcentaje es sobre el total de alcances marcados." } : {}),
          }))}
          active={paretoActive}
          hrefFor={paretoHref}
          unit="solicitudes"
        />
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

export default async function ChangeControlIndicatorsPage(...args: Parameters<typeof ChangeControlIndicatorsPageAuthenticatedContent>) {
  return authorizedPage("src/app/changes/indicators/page.tsx", () => ChangeControlIndicatorsPageAuthenticatedContent(...args), args);
}
