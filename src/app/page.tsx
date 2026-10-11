import Link from "next/link";
import "./dashboard.css";
import { getDashboardData } from "@/modules/dashboard/queries";
import {
  DASHBOARD_MODULES, moduleListHref, queryOption, queryPage, queryYear,
  type DashboardModule, type DashboardState, type DashboardTaskView,
} from "@/modules/dashboard/domain";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const modules = [...DASHBOARD_MODULES, { key: "PNT", label: "Documentación controlada", href: "/controlled-documents", indicatorHref: null }] as const;
const moduleKeys = ["ALL", ...modules.map(m => m.key)] as const;
const stateOptions = ["ALL", "OPEN", "CLOSED", "DRAFT"] as const;
const taskOptions = ["all", "overdue", "upcoming"] as const;
const number = (value: number) => value.toLocaleString("es-ES");
const date = (value: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
const moduleName = (key: DashboardModule) => modules.find(m => m.key === key)?.label ?? key;

function queryLink(query: Query, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["year", "department", "module", "state", "tasks"]) {
    const value = query[key], scalar = Array.isArray(value) ? value[0] : value;
    if (scalar) params.set(key, scalar);
  }
  if (page > 1) params.set("page", String(page));
  return "/?" + params.toString();
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  const year = queryYear(query.year);
  const requestedDepartment = Array.isArray(query.department) ? query.department[0] : query.department;
  const selectedScope = queryOption(query.module, moduleKeys, "ALL");
  const state = queryOption(query.state, stateOptions, "ALL") as DashboardState;
  const taskView = queryOption(query.tasks, taskOptions, "all") as DashboardTaskView;
  const now = new Date();
  const data = await getDashboardData({
    year,
    department: requestedDepartment && /^[a-f0-9-]{36}$/i.test(requestedDepartment) ? requestedDepartment : "",
    module: selectedScope,
    state,
    taskView,
    page: queryPage(query.page),
    asOf: now,
  });
  const department = data.departments.some(d => d.id === requestedDepartment) ? requestedDepartment! : "";
  const selectedModule = selectedScope === "ALL" ? "DEVIATION" : selectedScope;
  const moduleIndicators = DASHBOARD_MODULES.find(m => m.key === selectedModule);
  const peak = Math.max(1, ...data.trend.map(x => x.total ?? 0));
  const active = data.metrics.reduce((sum, m) => sum + m.open, 0);
  const draft = data.metrics.reduce((sum, m) => sum + m.draft, 0);
  const operational = data.metrics.reduce((sum, m) => sum + m.total - m.cancelled, 0);
  const yearSuffix = year ? " · año " + year : " · todos los años";

  return (
    <section className="workspace home-workspace dashboard-home" data-testid="qms-dashboard">
      <div className="home-hero">
        <div>
          <p className="eyebrow">COVEX · Sistema de Calidad</p>
          <h1>Panel de Calidad</h1>
          <p>Situación operativa, tareas con fecha, evolución de indicadores y acceso a los siete módulos.</p>
        </div>
        <div className="pilot-callout">
          <strong>Versión piloto</strong>
          <span>Herramienta interna · sin firma electrónica ni audit trail GMP validado.</span>
        </div>
      </div>

      <form method="get" className="dashboard-filter-panel" aria-label="Filtros del panel">
        <label>Área funcional
          <select name="module" defaultValue={selectedScope}>
            <option value="ALL">Todos los módulos</option>
            {modules.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label>Departamento
          <select name="department" defaultValue={department}>
            <option value="">Todos</option>
            {data.departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
        </label>
        <label>Año de cohorte
          <input name="year" type="number" inputMode="numeric" min="2000" max="2100" defaultValue={year ?? ""} placeholder="Todos" />
        </label>
        <label>Estado del expediente
          <select name="state" defaultValue={state}>
            <option value="ALL">Todos</option>
            <option value="OPEN">Abiertos</option>
            <option value="CLOSED">Cerrados</option>
            <option value="DRAFT">Borradores</option>
          </select>
        </label>
        <label>Plazos
          <select name="tasks" defaultValue={taskView}>
            <option value="all">Vencidos y próximos</option>
            <option value="overdue">Solo vencidos</option>
            <option value="upcoming">Solo próximos</option>
          </select>
        </label>
        <div className="dashboard-filter-actions">
          <button className="button primary" type="submit">Aplicar</button>
          <Link className="button" href="/">Limpiar</Link>
        </div>
      </form>

      <div className="dashboard-summary" aria-label="Resumen operativo">
        <article><span>Expedientes operativos{yearSuffix}</span><strong>{number(operational - draft)}</strong><small>Seis módulos; sin anulados, borradores ni cancelados</small></article>
        <article><span>Abiertos actualmente</span><strong>{number(active)}</strong><small>Según cohorte y módulo seleccionados</small></article>
        <article><span>Borradores</span><strong>{number(draft)}</strong><small>Contados aparte de los abiertos</small></article>
        <article><span>Eficacia pendiente</span><strong>{number(data.pendingEffectiveness.total)}</strong><small>{data.pendingEffectiveness.capa} CAPA · {data.pendingEffectiveness.changes} cambios</small></article>
        <article><span>Obligaciones con fecha</span><strong>{number(data.taskCounts.total)}</strong><small>{data.taskCounts.overdue} vencidas · {data.taskCounts.upcoming} próximas</small></article>
      </div>

      <section className="dashboard-section" aria-labelledby="dashboard-modules-title">
        <div className="dashboard-heading">
          <div><p className="eyebrow">Estado actual</p><h2 id="dashboard-modules-title">Expedientes por módulo</h2></div>
          <p>Los recuentos reflejan la población activa completa; no se calculan desde la página visible del listado.</p>
        </div>
        <div className="dashboard-module-grid">
          {data.metrics.map(item => (
            <article key={item.module} className="dashboard-module-card">
              <div className="dashboard-module-top"><span>{item.label}</span><strong>{number(item.selected)}</strong></div>
              <p>{state === "ALL" ? "Expedientes totales" : state === "OPEN" ? "Abiertos" : state === "CLOSED" ? "Cerrados" : "Borradores"} en la selección</p>
              <div className="dashboard-module-states">
                <span><strong>{item.open}</strong> Abiertos</span>
                <span><strong>{item.closed}</strong> Cerrados</span>
                <span><strong>{item.draft}</strong> Borradores</span>
              </div>
              <Link href={moduleListHref(item.href, state, year, department)} className="summary-link">Abrir expedientes →</Link>
            </article>
          ))}
          {(selectedScope === "ALL" || selectedScope === "PNT") && (
            <article className="dashboard-module-card dashboard-pnt-card">
              <div className="dashboard-module-top"><span>Documentación controlada</span><strong>{number(data.pnt.masters)}</strong></div>
              <p>Maestros documentales no anulados; el filtro de año no se aplica a PNT.</p>
              <div className="dashboard-module-states">
                <span><strong>{data.pnt.revisions}</strong> Revisiones</span>
                <span><strong>{data.pnt.overdue}</strong> Últimas vencidas</span>
                <span><strong>{data.pnt.unverified}</strong> Sin verificar</span>
              </div>
              <Link className="summary-link" href={department ? "/controlled-documents?department=" + encodeURIComponent(department) : "/controlled-documents"}>Ver documentación →</Link>
            </article>
          )}
        </div>
      </section>

      <div className="dashboard-two-col">
        <section className="dashboard-section dashboard-task-section" aria-labelledby="dashboard-tasks-title">
          <div className="dashboard-heading">
            <div><p className="eyebrow">Acción y seguimiento</p><h2 id="dashboard-tasks-title">Tareas del sistema</h2></div>
            <Link href="/settings/alerts" className="summary-link">Reglas de alertas →</Link>
          </div>
          <p className="dashboard-hint">Vista informativa, sin envío automático. Se muestran las reglas activas configuradas y revisiones/seguimientos con fecha hasta 30 días. No equivale a «mis tareas».</p>
          <div className="dashboard-task-table">
            <table aria-label="Obligaciones y fechas próximas o vencidas">
              <thead><tr><th>Vencimiento</th><th>Expediente</th><th>Motivo</th><th>Estado</th></tr></thead>
              <tbody>
                {data.tasks.map(task => (
                  <tr key={task.key}>
                    <td>{date(task.dueDate)}</td>
                    <td><Link href={task.href} className="summary-link">{task.code}</Link><small>{moduleName(task.module)}</small></td>
                    <td title={task.source}>{task.label}</td>
                    <td><span className={"badge " + (task.state === "OVERDUE" ? "critical" : "warning")}>{task.state === "OVERDUE" ? "Vencida" : "Próxima"}</span></td>
                  </tr>
                ))}
                {!data.tasks.length && <tr><td colSpan={4} className="dashboard-empty">No hay obligaciones con fecha para estos filtros. Esto no confirma que no existan otras acciones pendientes.</td></tr>}
              </tbody>
            </table>
          </div>
          {data.pageCount > 1 && <nav className="dashboard-pagination" aria-label="Páginas de obligaciones">
            <span>Página {data.page} de {data.pageCount}</span>
            {data.page > 1 && <Link className="button small" href={queryLink(query, data.page - 1)}>Anterior</Link>}
            {data.page < data.pageCount && <Link className="button small" href={queryLink(query, data.page + 1)}>Siguiente</Link>}
          </nav>}
        </section>

        <section className="dashboard-section dashboard-trend-section" aria-labelledby="dashboard-trend-title">
          <div className="dashboard-heading"><div><p className="eyebrow">KPI históricos</p><h2 id="dashboard-trend-title">Evolución de 5 años</h2></div></div>
          {data.trend.length ? <>
            <p className="dashboard-hint">{moduleName(selectedModule as DashboardModule)} · total de expedientes por año de apertura · {year ?? now.getUTCFullYear()} como año final. Los años sin cobertura no equivalen a cero.</p>
            <div className="dashboard-trend-rows" aria-label="Tendencia quinquenal">
              {data.trend.map(item => (
                <div key={item.year} className="dashboard-trend-row">
                  <strong>{item.year}</strong>
                  <div className="dashboard-trend-track">
                    {item.total !== null && <span style={{width: Math.max(item.total ? 2 : 0, (item.total / peak) * 100) + "%"}} aria-hidden="true" />}
                  </div>
                  <span>{item.total === null ? "Sin datos" : number(item.total)}</span>
                </div>
              ))}
            </div>
            {moduleIndicators?.indicatorHref && <Link className="summary-link" href={moduleIndicators.indicatorHref + "?year=" + String(year ?? now.getUTCFullYear()) + (department ? "&department=" + encodeURIComponent(department) : "")}>Ver indicadores completos →</Link>}
          </> : <>
            <p className="dashboard-hint">Auditorías y PNT utilizan reglas documentales y estados específicos. No se representa una tendencia de expedientes QMS sin una definición histórica comparable.</p>
            <Link className="summary-link" href={selectedScope === "PNT" ? "/controlled-documents" : "/audits"}>Consultar el módulo →</Link>
          </>}
          <div className="dashboard-footnote">Las cohortes de apertura y los KPI por fecha de cierre o eficacia son diferentes. Consulta el módulo para sus definiciones, numeradores y denominadores.</div>
        </section>
      </div>

      <section className="dashboard-section" aria-label="Accesos directos">
        <div className="dashboard-heading"><div><p className="eyebrow">Navegación</p><h2>Accesos a los módulos</h2></div></div>
        <nav className="dashboard-quick-links" aria-label="Módulos de Calidad">
          {modules.map(item => <Link href={item.href} key={item.key}>{item.label} <span aria-hidden="true">↗</span></Link>)}
        </nav>
      </section>
      <p className="dashboard-source-note">Datos actuales de PostgreSQL · corte {date(data.asOf)} (UTC) · consulta {data.elapsedMs} ms. El panel no registra ni modifica expedientes.</p>
    </section>
  );
}
