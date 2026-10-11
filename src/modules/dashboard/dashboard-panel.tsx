import Link from "next/link";
import { DASHBOARD_MODULES, type DashboardModule } from "./domain";
import type { getDashboardData } from "./queries";

type Data = Awaited<ReturnType<typeof getDashboardData>>;
const number = (value: number) => value.toLocaleString("es-ES");
const date = (value: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", year: "numeric", month: "short", day: "2-digit" }).format(value);
const label = (module: DashboardModule) => DASHBOARD_MODULES.find(x => x.key === module)?.label ?? module;

function homeUrl(data: Data, patch: { page?: number; taskView?: "all" | "overdue" | "upcoming" }) {
  const q = new URLSearchParams();
  if (data.filters.year) q.set("year", String(data.filters.year));
  if (data.filters.departmentId) q.set("department", data.filters.departmentId);
  q.set("module", data.filters.module);
  const taskView = patch.taskView ?? data.filters.taskView;
  if (taskView !== "all") q.set("taskView", taskView);
  const page = patch.page ?? data.filters.page;
  if (page > 1) q.set("page", String(page));
  return "/?" + q.toString();
}
export function DashboardPanel({ data }: { data: Data }) {
  const selected = data.filters.module;
  const trend = data.trend;
  const biggest = Math.max(1, ...((trend?.points ?? []).filter(x => x.dataAvailable).map(x => x.total)));
  return (
    <section className="dashboard-panel" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Visión transversal · D1B</p>
          <h2 id="dashboard-title">Centro de control de Calidad</h2>
          <p>Recuento por expediente, tareas con fecha y tendencias históricas. Fuente: PostgreSQL.</p>
        </div>
        <span className="badge neutral">Fecha de corte: {date(data.asOf)}</span>
      </div>
      <form method="get" action="/" className="dashboard-filters" aria-label="Filtros del centro de control">
        <label>Año de expediente
          <select name="year" defaultValue={data.filters.year ? String(data.filters.year) : ""}>
            <option value="">Todos · estado actual</option>
            {data.years.map(y => <option value={y} key={y}>{y}</option>)}
          </select>
        </label>
        <label>Departamento
          <select name="department" defaultValue={data.filters.departmentId ?? ""}>
            <option value="">Todos los departamentos</option>
            {data.departments.map(d => <option key={d.id} value={d.id}>{d.code} · {d.name}</option>)}
          </select>
        </label>
        <label>Indicadores de
          <select name="module" defaultValue={selected}>
            {DASHBOARD_MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <input type="hidden" name="taskView" value={data.filters.taskView} />
        <button className="button primary" type="submit">Aplicar</button>
        <Link href="/" className="button">Limpiar</Link>
      </form>
      <p className="dashboard-explain">El año y departamento filtran los expedientes y las tareas de los seis módulos QMS. El maestro de PNT no dispone de año de expediente: se muestra siempre su estado actual. Las tarjetas incluyen borradores por separado y excluyen anulados administrativamente.</p>
      <div className="dashboard-card-grid" aria-label="Resumen por módulo">
        {data.cards.map(card => {
          const isPnt = card.module === "PNT";
          return <article className="dashboard-module-card" key={card.module}>
            <div className="dashboard-module-head">
              <span className="dashboard-module-icon" aria-hidden="true">{card.module === "PNT" ? "§" : card.module === "AUDIT" ? "✓" : "◈"}</span>
              <strong>{label(card.module)}</strong>
            </div>
            <div className="dashboard-module-stat"><strong>{number(card.total)}</strong><span>{isPnt ? "PNT activos" : "Expedientes activos en registro"}</span></div>
            <div className="dashboard-module-meta">
              {isPnt ? <>
                <span><b>{number(data.pntRevisionsInForce)}</b> revisiones en vigor</span>
                <span><b>{number(card.open)}</b> PNT con revisión vencida</span>
              </> : <>
                <span><b>{number(card.open)}</b> abiertos</span>
                <span><b>{number(card.draft)}</b> borradores</span>
                <span><b>{number(card.closed)}</b> cerrados</span>
                {card.other ? <span><b>{number(card.other)}</b> otros estados</span> : null}
              </>}
            </div>
            <div className="dashboard-module-footer">
              <Link href={card.href}>Ver listado →</Link>
              {DASHBOARD_MODULES.find(m => m.key === card.module)?.indicators ?
                <Link href={DASHBOARD_MODULES.find(m => m.key === card.module)!.indicators!}>Indicadores</Link> : null}
            </div>
          </article>;
        })}
      </div>
      <div className="dashboard-grid">
        <section className="card dashboard-tasks" aria-labelledby="dashboard-tasks-title">
          <div className="dashboard-section-head">
            <div><h3 id="dashboard-tasks-title">Tareas y vencimientos detectados</h3>
              <p>Seguimientos y revisiones con fecha; no se envían avisos automáticos.</p></div>
            <Link href="/settings/alerts" className="button small">Reglas de alerta</Link>
          </div>
          <div className="dashboard-totals">
            <Link href={homeUrl(data, { taskView: "overdue", page: 1 })} className={data.filters.taskView === "overdue" ? "selected" : ""}><strong>{number(data.totals.overdue)}</strong> vencidos</Link>
            <Link href={homeUrl(data, { taskView: "upcoming", page: 1 })} className={data.filters.taskView === "upcoming" ? "selected" : ""}><strong>{number(data.totals.upcoming)}</strong> próximos</Link>
            <Link href={homeUrl(data, { taskView: "all", page: 1 })} className={data.filters.taskView === "all" ? "selected" : ""}><strong>{number(data.totals.affectedRecords)}</strong> expedientes afectados</Link>
          </div>
          <div className="table-scroll">
            <table className="dashboard-task-table">
              <thead><tr><th>Estado</th><th>Fecha</th><th>Módulo</th><th>Expediente</th><th>Obligación</th></tr></thead>
              <tbody>
                {data.tasks.items.map(task => <tr key={task.key}>
                  <td><span className={"badge " + (task.state === "OVERDUE" ? "critical" : "warning")}>{task.state === "OVERDUE" ? "Vencido" : "Próximo"}</span></td>
                  <td>{date(task.dueDate)}</td><td>{label(task.module)}</td>
                  <td><Link className="summary-link" href={task.href}>{task.businessCode}</Link></td>
                  <td className="table-cell-wrap"><strong>{task.label}</strong><small>{task.detail}</small></td>
                </tr>)}
              </tbody>
            </table>
            {data.tasks.total === 0 ? <p className="empty-panel">No se han detectado tareas con fecha para estos filtros y reglas. No equivale a ausencia de obligaciones GMP.</p> : null}
          </div>
          <nav className="dashboard-pagination" aria-label="Páginas de tareas">
            <span>{data.tasks.total} tareas · página {data.tasks.page} de {data.tasks.pages}</span>
            <div>
              {data.tasks.page > 1 ? <Link className="button small" href={homeUrl(data,{page:data.tasks.page-1})}>Anterior</Link> : null}
              {data.tasks.page < data.tasks.pages ? <Link className="button small" href={homeUrl(data,{page:data.tasks.page+1})}>Siguiente</Link> : null}
            </div>
          </nav>
        </section>
        <section className="card dashboard-trends" aria-labelledby="dashboard-trends-title">
          <div className="dashboard-section-head">
            <div>
              <h3 id="dashboard-trends-title">Evolución histórica · {label(selected)}</h3>
              <p>Últimos cinco años hasta {data.filters.year ?? data.asOf.getUTCFullYear()}; volumen por cohorte de apertura.</p>
            </div>
            {trend ? <Link href={trend.indicatorHref} className="button small">Ver KPI completos</Link> : null}
          </div>
          {trend ? <>
            <div className="dashboard-bars" role="img" aria-label={"Evolución anual de expedientes de "+label(selected)}>
              {trend.points.map(p => <div className="dashboard-bar-column" key={p.year}>
                <div className="dashboard-bar-frame">
                  {p.dataAvailable ? <span className="dashboard-bar-value">{number(p.total)}</span> : <span className="dashboard-missing">s/d</span>}
                  {p.dataAvailable ? <span className="dashboard-bar" style={{ height: Math.max(p.total ? 5 : 2, Math.round(p.total/biggest*82))+"%" }} /> : null}
                </div>
                <span>{p.year}</span>
              </div>)}
            </div>
            <div className="table-scroll"><table className="dashboard-trend-table"><thead><tr><th>Año</th><th>Expedientes</th><th>Abiertos ahora</th></tr></thead><tbody>
              {trend.points.map(p => <tr key={p.year}><td>{p.year}</td><td>{p.dataAvailable ? number(p.total) : "Sin datos"}</td><td>{p.dataAvailable ? number(p.open) : "Sin datos"}</td></tr>)}
            </tbody></table></div>
          </> : <div className="empty-panel">{selected === "PNT" ? "Los PNT disponen de métricas de revisión actuales, no de una serie quinquenal comparable. Consulta el listado documental." : "Las auditorías se muestran por estado actual. La serie histórica se incorpora por año de codificación cuando existen datos comparables."}</div>}
          <p className="dashboard-disclaimer">Los años sin cobertura no se representan como cero. Los indicadores de cierre y eficacia utilizan cohortes y fechas propias de cada módulo, consultables en sus páginas de indicadores.</p>
        </section>
      </div>
    </section>
  );
}
