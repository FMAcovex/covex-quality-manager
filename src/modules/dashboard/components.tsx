import Link from "next/link";
import { DASHBOARD_MODULES, type DashboardFilters } from "./domain";
import type { AwaitedDashboard } from "./types";

const showDay = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(d);
const displayed = (n: number) => new Intl.NumberFormat("es-ES").format(n);
const moduleLabel = (module: string) => DASHBOARD_MODULES.find(m => m.key === module)?.label ?? module;

function query(filters: DashboardFilters, nextPage: number) {
  const params = new URLSearchParams({ module: filters.module, year: String(filters.year), taskView: filters.taskView, page: String(nextPage) });
  if (filters.departmentId) params.set("department", filters.departmentId);
  return "/?" + params.toString() + "#dashboard-tasks";
}
export function DashboardOverview({ data }: { data: AwaitedDashboard }) {
  const { cards, filters, tasks, totals, trend } = data;
  const max = Math.max(1, ...(trend?.points.filter(p => p.dataAvailable).map(p => p.total) ?? []));
  return <section className="dashboard-overview" aria-labelledby="dashboard-title">
    <div className="dashboard-section-heading">
      <div>
        <p className="eyebrow">Situación del sistema de calidad</p>
        <h2 id="dashboard-title">Panel de seguimiento</h2>
        <p>Expedientes activos en la base de datos, sin duplicar relaciones, documentos o productos. Corte: {showDay(data.asOf)}.</p>
      </div>
      <Link className="button" href="/settings/alerts">Administrar vencimientos →</Link>
    </div>
    <form method="get" className="dashboard-filters" aria-label="Filtros del dashboard">
      <label><span>Departamento</span><select name="department" defaultValue={filters.departmentId ?? ""}>
        <option value="">Todos los departamentos</option>
        {data.departments.map(d => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
      </select></label>
      <label><span>Tendencia de</span><select name="module" defaultValue={filters.module}>
        {DASHBOARD_MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select></label>
      <label><span>Año de referencia</span><input name="year" type="number" min="2000" max="2100" defaultValue={filters.year} /></label>
      <label><span>Tareas</span><select name="taskView" defaultValue={filters.taskView}>
        <option value="all">Todas</option><option value="overdue">Vencidas</option><option value="upcoming">Próximas</option>
      </select></label>
      <div className="dashboard-filter-actions"><button className="button primary" type="submit">Aplicar</button><Link className="button" href="/">Limpiar</Link></div>
    </form>
    <div className="dashboard-status-summary" aria-label="Resumen de seguimiento">
      <div><strong>{displayed(cards.filter(c => c.module !== "PNT").reduce((n, c) => n + c.open, 0))}</strong><span>Expedientes abiertos · 6 módulos</span></div>
      <div><strong>{displayed(totals.overdue)}</strong><span>Obligaciones de seguimiento vencidas</span></div>
      <div><strong>{displayed(totals.upcoming)}</strong><span>Obligaciones de seguimiento próximas</span></div>
      <div><strong>{displayed(totals.affectedRecords)}</strong><span>Registros distintos con tareas</span></div>
    </div>
    <div className="dashboard-card-grid" aria-label="Recuento por módulo">
      {cards.map(c => {
        const name = moduleLabel(c.module);
        const isPnt = c.module === "PNT";
        return <Link key={c.module} href={c.href} className="dashboard-module-tile">
          <span>{name}</span><strong>{displayed(c.total)}</strong>
          <small>{isPnt ? "Maestros activos" : "Expedientes activos (incluye borradores)"}</small>
          <span className="dashboard-module-breakdown">
            <span>{isPnt ? "Revisión vencida" : "Abiertos"} <b>{displayed(c.open)}</b></span>
            {!isPnt ? <span>Borradores <b>{displayed(c.draft)}</b></span> : <span>Revisiones vigentes <b>{displayed(data.pntRevisionsInForce)}</b></span>}
          </span>
        </Link>;
      })}
    </div>
    <div className="dashboard-lower-grid">
      <section className="card dashboard-trend-panel" aria-labelledby="dashboard-trend-title">
        <div className="dashboard-section-heading"><div>
          <p className="eyebrow">Cohortes</p>
          <h3 id="dashboard-trend-title">Tendencia a cinco años · {moduleLabel(filters.module)}</h3>
        </div>{trend ? <Link className="summary-link" href={trend.indicatorHref}>Ver indicadores detallados →</Link> : null}</div>
        {trend ? <>
          <div className="dashboard-trend-chart" role="img" aria-label={trend.points.map(p => p.year + ": " + (p.dataAvailable ? p.total + " expedientes" : "Sin datos")).join("; ")}>
            {trend.points.map(p => <div className="dashboard-year-column" key={p.year}>
              <div className="dashboard-year-value">{p.dataAvailable ? displayed(p.total) : "—"}</div>
              <div className="dashboard-bar-area">{p.dataAvailable ? <div className="dashboard-bar" style={{ height: p.total ? Math.max(5, 100 * p.total / max) + "%" : "4px" }} /> : <div className="dashboard-no-data">Sin datos</div>}</div>
              <div className="dashboard-year-label">{p.year}</div>
            </div>)}
          </div>
          <p className="dashboard-note">Altas por año de apertura/codificación; no representan cierres del año. «Sin datos» no equivale a cero.</p>
        </> : <p className="dashboard-empty">Para {moduleLabel(filters.module)} no existe aún una serie histórica quinquenal homologada en la aplicación. Consulta el estado actual en las tarjetas superiores y el listado del módulo.</p>}
      </section>
      <section className="card dashboard-work-panel" id="dashboard-tasks" aria-labelledby="dashboard-task-title">
        <div className="dashboard-section-heading"><div><p className="eyebrow">Bandeja transversal</p><h3 id="dashboard-task-title">Tareas y vencimientos</h3></div><strong>{displayed(tasks.total)}</strong></div>
        <p className="dashboard-note">Fechas de los seguimientos registrados y reglas configuradas ({data.alertRuleCount} activas); no implica aviso automático ni incumplimiento GMP.</p>
        {tasks.items.length ? <div className="dashboard-tasks-scroll"><table className="dashboard-tasks-table"><thead><tr><th>Estado</th><th>Fecha</th><th>Expediente</th><th>Acción</th></tr></thead><tbody>
          {tasks.items.map(t => <tr key={t.key}>
            <td><span className={t.state === "OVERDUE" ? "badge critical" : "badge warning"}>{t.state === "OVERDUE" ? "Vencida" : "Próxima"}</span></td>
            <td>{showDay(t.dueDate)}</td><td><Link className="summary-link" href={t.href}>{t.businessCode}</Link><small>{moduleLabel(t.module)}</small></td>
            <td><strong>{t.label}</strong><small>{t.detail}</small></td>
          </tr>)}
        </tbody></table></div> : <p className="dashboard-empty">No hay tareas en este filtro. Es posible que todavía no existan reglas activas o fechas de seguimiento registradas.</p>}
        {tasks.pages > 1 ? <nav className="dashboard-pagination" aria-label="Páginas de tareas">
          <Link className={tasks.page === 1 ? "button disabled" : "button"} aria-disabled={tasks.page === 1} href={query(filters, Math.max(1, tasks.page - 1))}>Anterior</Link>
          <span>Página {tasks.page} de {tasks.pages}</span>
          <Link className={tasks.page === tasks.pages ? "button disabled" : "button"} aria-disabled={tasks.page === tasks.pages} href={query(filters, Math.min(tasks.pages, tasks.page + 1))}>Siguiente</Link>
        </nav> : null}
      </section>
    </div>
  </section>;
}
