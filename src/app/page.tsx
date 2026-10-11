import Link from "next/link";
import { getDashboard } from "@/modules/dashboard/queries";
import { DASHBOARD_MODULES, normalizeDashboardFilters, type DashboardModule, type DashboardFilters } from "@/modules/dashboard/domain";

export const dynamic = "force-dynamic";

function moduleHref(href: string, department: string, status?: string) {
  const params = new URLSearchParams();
  if (department) params.set("department", department);
  if (status) params.set("status", status);
  return href + (params.size ? "?" + params.toString() : "");
}
function dashboardHref(filters: DashboardFilters, next: Partial<DashboardFilters>) {
  const values = { ...filters, ...next };
  const params = new URLSearchParams();
  params.set("year", String(values.year));
  if (values.department) params.set("department", values.department);
  if (values.module !== "ALL") params.set("module", values.module);
  if (values.taskView !== "all") params.set("taskView", values.taskView);
  if (values.page > 1) params.set("page", String(values.page));
  return "/?" + params.toString();
}
const displayDate = (value: string) => value ? value.split("-").reverse().join("/") : "—";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = normalizeDashboardFilters(await searchParams);
  const dashboard = await getDashboard(filters);
  const f = dashboard.filters;
  const selected = DASHBOARD_MODULES.find(m => m.id === (f.module === "ALL" ? "DEVIATION" : f.module));
  const trendMax = Math.max(1, ...(dashboard.trend?.trend.flatMap(x => x.total === null ? [] : [x.total]) ?? []));
  const selectedName = selected?.name ?? "Desviaciones";
  const moduleName = (id: DashboardModule) => DASHBOARD_MODULES.find(m => m.id === id)?.name ?? id;

  return (
    <section className="workspace home-workspace dashboard-workspace">
      <div className="home-hero">
        <div>
          <p className="eyebrow">COVEX · Sistema de Calidad</p>
          <h1>Gestión del Sistema de Calidad</h1>
          <p>Visión global de expedientes, tareas de seguimiento e indicadores. Datos consultados en PostgreSQL.</p>
        </div>
        <div className="pilot-callout">
          <strong>Versión piloto</strong>
          <span>Herramienta interna · sin firma electrónica ni audit trail GMP validado.</span>
          <span>Actualizado con fecha de corte {displayDate(dashboard.asOf)} (UTC).</span>
        </div>
      </div>

      <section className="dashboard-panel" aria-label="Filtros del dashboard">
        <div className="dashboard-panel-heading">
          <div><p className="eyebrow">Seguimiento del sistema</p><h2>Panel global de Calidad</h2></div>
          <span className="dashboard-caption">Recuentos actuales y tendencias históricas separados</span>
        </div>
        <form method="get" className="dashboard-filters">
          <label><span>Módulo / tendencia</span>
            <select name="module" defaultValue={f.module}>
              <option value="ALL">Todos · tendencia Desviaciones</option>
              {DASHBOARD_MODULES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label><span>Departamento</span>
            <select name="department" defaultValue={f.department}>
              <option value="">Todos</option>
              {dashboard.departments.map(d => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
            </select>
          </label>
          <label><span>Año de la tendencia</span>
            <select name="year" defaultValue={String(f.year)}>
              {Array.from(new Set([f.year, ...Array.from({ length: 8 }, (_, i) => new Date().getUTCFullYear() - i)]))
                .sort((a, b) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label><span>Bandeja de tareas</span>
            <select name="taskView" defaultValue={f.taskView}>
              <option value="all">Todas</option><option value="overdue">Vencidas</option><option value="upcoming">Próximas</option>
            </select>
          </label>
          <div className="dashboard-filter-buttons"><button type="submit" className="button primary">Aplicar</button>
            <Link href="/" className="button">Limpiar</Link></div>
        </form>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-operational">
        <div className="dashboard-section-heading">
          <div><p className="eyebrow">Estado actual</p><h2 id="dashboard-operational">Expedientes por módulo</h2></div>
          <span className="dashboard-caption">Activos administrativamente · todos los años · borradores separados</span>
        </div>
        <div className="dashboard-status-grid">
          {dashboard.status.grouped.map(s => {
            const pnt = s.module === "PNT";
            return <article key={s.module} className="dashboard-status-card">
              <header><strong>{moduleName(s.module)}</strong><Link href={moduleHref(s.href, f.department)} aria-label={"Abrir " + moduleName(s.module)}>Abrir ↗</Link></header>
              <div className="dashboard-status-main">
                <Link href={moduleHref(s.openHref, f.department)} className="dashboard-status-value">{s.open}</Link>
                <span>{pnt ? "Maestros activos" : "Expedientes abiertos"}</span>
              </div>
              <div className="dashboard-status-meta"><span>{s.drafts} borradores</span>
                <span>{pnt ? dashboard.status.pnt.revisions + " revisiones" : s.closed + " cerrados"}</span>
                <span>{s.total} {pnt ? "maestros" : "registros"}</span></div>
            </article>;
          })}
        </div>
        <p className="dashboard-caption dashboard-footnote">
          Los recuentos operativos no excluyen `includeInKpi=false`. Una relación, acción, producto o revisión no crea otro expediente.
          PNT se mide por maestros documentales, no por expedientes; las revisiones se muestran por separado.
        </p>
      </section>

      <section className="dashboard-overview-grid" aria-label="Alertas y tendencias">
        <article className="dashboard-panel dashboard-priority">
          <div className="dashboard-panel-heading">
            <div><p className="eyebrow">Pendiente de atención</p><h2>Tareas del sistema</h2></div>
            <Link href="/settings/alerts" className="summary-link">Reglas y vencimientos ↗</Link>
          </div>
          <div className="dashboard-priority-stats">
            <Link href={dashboardHref(f, { taskView: "overdue", page: 1 })}><strong>{dashboard.taskCounts.overdue}</strong><span>Vencidas</span></Link>
            <Link href={dashboardHref(f, { taskView: "upcoming", page: 1 })}><strong>{dashboard.taskCounts.upcoming}</strong><span>Próximas / en preaviso</span></Link>
            <div><strong>{dashboard.status.capaEfficacy + dashboard.status.changeEfficacy}</strong><span>CAPA/CC en espera de eficacia</span></div>
          </div>
          <p className="dashboard-caption">Obligaciones fechadas; reglas configuradas y revisiones de Auditorías, Desviaciones y PNT. La eficacia pendiente se cuenta aparte.</p>
          <div className="dashboard-task-table-wrap">
            <table className="dashboard-task-table">
              <thead><tr><th>Fecha</th><th>Expediente</th><th>Motivo</th><th>Estado</th></tr></thead>
              <tbody>
                {dashboard.tasks.items.map(t => <tr key={t.key}>
                  <td>{displayDate(t.dueDate)}</td>
                  <td><Link href={t.href}>{t.code}</Link><small>{moduleName(t.module)}</small></td>
                  <td className="dashboard-task-label">{t.label}</td>
                  <td><span className={"badge " + (t.state === "OVERDUE" ? "critical" : "warning")}>
                    {t.state === "OVERDUE" ? "Vencida" : "Próxima"}</span></td>
                </tr>)}
                {!dashboard.tasks.items.length && <tr><td colSpan={4} className="dashboard-table-empty">No hay tareas en este filtro.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="dashboard-pager">
            <span>{dashboard.tasks.total} tareas · página {dashboard.tasks.page} de {dashboard.tasks.pages}</span>
            <div><Link className={"button small" + (dashboard.tasks.page === 1 ? " dashboard-disabled" : "")}
              href={dashboardHref(f, { page: Math.max(1, dashboard.tasks.page - 1) })}>Anterior</Link>
              <Link className={"button small" + (dashboard.tasks.page === dashboard.tasks.pages ? " dashboard-disabled" : "")}
                href={dashboardHref(f, { page: Math.min(dashboard.tasks.pages, dashboard.tasks.page + 1) })}>Siguiente</Link></div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-trend">
          <div className="dashboard-panel-heading">
            <div><p className="eyebrow">Evolución</p><h2>{selectedName} · últimos cinco años</h2></div>
            {selected?.indicators ? <Link className="summary-link" href={moduleHref(selected.indicators, f.department)}>Ver indicadores ↗</Link> :
              <Link className="summary-link" href={moduleHref(selected?.href ?? "/deviations", f.department)}>Ver módulo ↗</Link>}
          </div>
          {dashboard.trend ? <>
            <p className="dashboard-caption">Año de cohorte · expedientes operativos, excluidos borradores/anulados y registros fuera de KPI según el módulo.</p>
            <div className="dashboard-trend-chart" role="img" aria-label={"Tendencia de aperturas de " + selectedName}>
              {dashboard.trend.trend.map(p => <div key={p.year} className="dashboard-trend-column">
                <span className="dashboard-trend-count">{p.dataAvailable ? p.total : "s/d"}</span>
                <div className="dashboard-trend-bar-track">
                  {p.total !== null && <span className="dashboard-trend-bar"
                    style={{ height: p.total ? Math.max(3, (p.total / trendMax) * 100) + "%" : "0%" }} />}
                </div>
                <span className="dashboard-trend-year">{p.year}</span>
              </div>)}
            </div>
            <p className="dashboard-caption">«s/d» indica ausencia de cobertura confirmada, no cero expedientes. Los indicadores de cierre y eficacia usan su propio año de evento.</p>
          </> : <div className="dashboard-trend-unavailable">
            <strong>No existe una serie quinquenal comparable para {selectedName}.</strong>
            <p>Consulta los indicadores específicos del listado. No se infiere una serie sin definiciones y cobertura histórica.</p>
          </div>}
          <div className="dashboard-document-footnote">
            <strong>Documentación controlada</strong>
            <p>{dashboard.status.pnt.masters} maestros registrados · {dashboard.status.pnt.revisions} revisiones · {dashboard.status.pnt.inForce} revisiones marcadas como vigentes.</p>
            <Link href={moduleHref("/controlled-documents?quick=overdue", f.department)}>Ver revisiones pendientes ↗</Link>
          </div>
        </article>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-access">
        <div className="dashboard-section-heading">
          <div><p className="eyebrow">Acceso rápido</p><h2 id="dashboard-access">Módulos de Calidad</h2></div>
          <span className="dashboard-caption">Expedientes, anexos, relaciones e histórico</span>
        </div>
        <div className="dashboard-module-links">
          {DASHBOARD_MODULES.map(m => <Link href={m.href} key={m.id} className="dashboard-module-link">
            <strong>{m.name}</strong><span>Abrir módulo ↗</span>
          </Link>)}
        </div>
      </section>
      <p className="dashboard-caption dashboard-footnote">Panel de supervisión de desarrollo. No constituye aceptación documental, validación GMP ni notificación automática.</p>
    </section>
  );
}
