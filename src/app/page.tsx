import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { ListFilterToolbar } from "@/components/list-filter-toolbar";
import { activeFilterChips, type FilterDefinition } from "@/lib/qms/list-filters";
import "./dashboard.css";
import { getDashboardData } from "@/modules/dashboard/queries";
import {
  DASHBOARD_ALL_MODULES, DASHBOARD_MODULES, moduleListHref, queryOption, queryPage, queryYear,
  type DashboardModule, type DashboardState, type DashboardTaskView,
} from "@/modules/dashboard/domain";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;
const modules = DASHBOARD_ALL_MODULES;
const moduleKeys = ["ALL", ...modules.map(m => m.key)] as const;
const stateOptions = ["ALL", "OPEN", "CLOSED", "DRAFT"] as const;
const taskOptions = ["all", "overdue", "upcoming"] as const;
const number = (value: number) => value.toLocaleString("es-ES");
const date = (value: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
const moduleName = (key: DashboardModule) => modules.find(m => m.key === key)?.label ?? key;
const stateLabels = [{ value: "OPEN", label: "Abiertos" }, { value: "CLOSED", label: "Cerrados" }, { value: "DRAFT", label: "Borradores" }];
const taskLabels = [{ value: "overdue", label: "Solo vencidos" }, { value: "upcoming", label: "Solo próximos" }];

function queryLink(query: Query, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["year", "department", "module", "state", "tasks"]) {
    const value = query[key], scalar = Array.isArray(value) ? value[0] : value;
    if (scalar) params.set(key, scalar);
  }
  if (page > 1) params.set("page", String(page));
  return "/?" + params.toString();
}

async function HomePageAuthenticatedContent({
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
  const closed = data.metrics.reduce((sum, m) => sum + m.closed, 0);
  const selected = data.metrics.reduce((sum, m) => sum + m.selected, 0);
  const listFilters = (extra: Record<string, string>) => {
    const params = new URLSearchParams(extra);
    if (year) params.set("year", String(year));
    if (department) params.set("department", department);
    return "?" + params.toString();
  };
  // Etiquetas solo para los filtros distintos del valor por defecto.
  const appliedQuery: Query = {
    module: selectedScope === "ALL" ? undefined : selectedScope,
    department: department || undefined,
    year: year ? String(year) : undefined,
    state: state === "ALL" ? undefined : state,
    tasks: taskView === "all" ? undefined : taskView,
  };
  const filterDefinitions: FilterDefinition[] = [
    { name: "module", label: "Área", options: modules.map(m => ({ value: m.key, label: m.label })) },
    { name: "department", label: "Departamento", options: data.departments.map(d => ({ value: d.id, label: d.code })) },
    { name: "year", label: "Año de apertura", options: [] },
    { name: "state", label: "Estado", options: stateLabels },
    { name: "tasks", label: "Plazos", options: taskLabels },
  ];

  return (
    <section className="workspace home-workspace dashboard-home qms-list-ux-b list-ux-c" data-testid="qms-dashboard">
      <div className="home-hero">
        <div>
          <p className="eyebrow">COVEX · Sistema de Calidad</p>
          <h1>Panel de Calidad</h1>
          <p>Estado de los expedientes, próximos plazos y evolución del Sistema de Calidad.</p>
        </div>
        <div className="pilot-callout">
          <strong>Versión piloto</strong>
          <span>Herramienta interna · sin firma electrónica ni audit trail GMP validado.</span>
        </div>
      </div>

      <form id="dashboard-filters" method="get" className="toolbar-form dashboard-filters" aria-label="Filtros del panel">
        <ListFilterToolbar storageKey="qms.filters.dashboard" clearHref="/" chips={activeFilterChips("/", appliedQuery, filterDefinitions)}>
          <label className="filter-placeholder"><span>Área</span>
            <select name="module" defaultValue={selectedScope}>
              <option value="ALL">Todos los módulos</option>
              {modules.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <label className="filter-placeholder"><span>Departamento</span>
            <select name="department" defaultValue={department}>
              <option value="">Todos</option>
              {data.departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
            </select>
          </label>
          <label className="filter-placeholder"><span>Año de apertura</span>
            <input name="year" type="number" inputMode="numeric" min="2000" max="2100" defaultValue={year ?? ""} placeholder="Todos" />
          </label>
          <label className="filter-placeholder"><span>Estado del expediente</span>
            <select name="state" defaultValue={state}>
              <option value="ALL">Todos</option>
              {stateLabels.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="filter-placeholder"><span>Plazos</span>
            <select name="tasks" defaultValue={taskView}>
              <option value="all">Vencidos y próximos</option>
              {taskLabels.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </ListFilterToolbar>
      </form>

      <section className="dashboard-attention" aria-label="Requiere atención">
        <a href="#dashboard-tasks" className={"dashboard-attention-item" + (data.taskCounts.overdue ? " is-critical" : "")}>
          <strong>{number(data.taskCounts.overdue)}</strong><span>plazos vencidos</span>
        </a>
        <a href="#dashboard-tasks" className={"dashboard-attention-item" + (data.taskCounts.upcoming ? " is-warning" : "")}>
          <strong>{number(data.taskCounts.upcoming)}</strong><span>vencen en 30 días</span>
        </a>
        <div className={"dashboard-attention-item" + (data.pendingEffectiveness.total ? " is-warning" : "")}>
          <strong>{number(data.pendingEffectiveness.total)}</strong><span>eficacia pendiente</span>
          <small>
            <Link href={"/capa" + listFilters({ status: "CLOSED", effectiveness: "PENDING" })}>{data.pendingEffectiveness.capa} CAPA</Link>
            {" · "}
            <Link href={"/changes" + listFilters({ status: "OPEN", execution: "EXECUTED", effectiveness: "PENDING" })}>{data.pendingEffectiveness.changes} cambios</Link>
          </small>
        </div>
        <div className="dashboard-attention-item">
          <strong>{number(draft)}</strong><span>borradores sin abrir</span>
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-modules-title">
        <div className="dashboard-heading">
          <div><p className="eyebrow">Estado actual</p><h2 id="dashboard-modules-title">Expedientes por módulo</h2></div>
        </div>
        <div className="dashboard-module-table">
          <table>
            <thead><tr><th>Módulo</th><th>{state === "ALL" ? "Total" : state === "OPEN" ? "Abiertos" : state === "CLOSED" ? "Cerrados" : "Borradores"}</th><th>Abiertos</th><th>Cerrados</th><th>Borradores</th><th><span className="sr-only">Listado</span></th></tr></thead>
            <tbody>
              {data.metrics.map(item => (
                <tr key={item.module} className={"dashboard-module-row" + (item.selected ? "" : " is-empty")} data-module={item.module}>
                  <th scope="row">{item.label}</th>
                  <td className="dashboard-module-total" data-label="Total">{number(item.selected)}</td>
                  <td className="dashboard-module-open" data-label="Abiertos">{number(item.open)}</td>
                  <td data-label="Cerrados">{number(item.closed)}</td>
                  <td data-label="Borradores">{number(item.draft)}</td>
                  <td className="dashboard-module-link"><Link href={moduleListHref(item.href, state, year, department)} className="summary-link">Abrir →</Link></td>
                </tr>
              ))}
            </tbody>
            {data.metrics.length > 1 ? <tfoot><tr><th scope="row">Total</th><td data-label="Total">{number(selected)}</td><td data-label="Abiertos">{number(active)}</td><td data-label="Cerrados">{number(closed)}</td><td data-label="Borradores">{number(draft)}</td><td /></tr></tfoot> : null}
          </table>
        </div>
        {(selectedScope === "ALL" || selectedScope === "PNT") && (
          <p className="dashboard-pnt-line">
            <strong>Documentación controlada</strong>
            <span><b>{number(data.pnt.masters)}</b> procedimientos</span>
            <span><b>{number(data.pnt.revisions)}</b> revisiones</span>
            <span className={data.pnt.overdue ? "dashboard-overdue-text" : ""}><b>{number(data.pnt.overdue)}</b> con revisión vencida</span>
            <span><b>{number(data.pnt.unverified)}</b> sin verificar</span>
            <Link className="summary-link" href={department ? "/controlled-documents?department=" + encodeURIComponent(department) : "/controlled-documents"}>Ver documentación →</Link>
          </p>
        )}
      </section>

      <div className="dashboard-two-col">
        <section id="dashboard-tasks" className="dashboard-section dashboard-task-section" aria-labelledby="dashboard-tasks-title">
          <div className="dashboard-heading">
            <div><p className="eyebrow">Acción y seguimiento</p><h2 id="dashboard-tasks-title">Plazos vencidos y próximos</h2></div>
            <PermissionGate permission="READ" module="SYSTEM"><Link href="/settings/alerts" className="summary-link">Reglas de alertas →</Link></PermissionGate>
          </div>
          <div className="dashboard-task-summary" aria-label="Resumen de plazos">
            <span className="dashboard-deadline-count overdue"><strong>{number(data.taskCounts.overdue)}</strong> vencidas</span>
            <span className="dashboard-deadline-count upcoming"><strong>{number(data.taskCounts.upcoming)}</strong> próximas · 30 días</span>
          </div>
          <p className="dashboard-hint">Revisiones y seguimientos con fecha según las reglas activas. Solo informativo: no envía avisos ni es una lista de tareas personal.</p>
          <div className="dashboard-task-table">
            <table aria-label="Plazos vencidos y próximos">
              <thead><tr><th>Vencimiento</th><th>Expediente</th><th>Motivo</th><th>Estado</th></tr></thead>
              <tbody>
                {data.tasks.map(task => (
                  <tr key={task.key} className={"dashboard-task-row " + (task.state === "OVERDUE" ? "is-overdue" : "is-upcoming")}>
                    <td className="dashboard-task-date" data-label="Vencimiento"><time dateTime={task.dueDate.toISOString().slice(0, 10)}>{date(task.dueDate)}</time></td>
                    <td className="dashboard-task-record"><Link href={task.href} className="summary-link">{task.code}</Link><small>{moduleName(task.module)}</small></td>
                    <td className="dashboard-task-reason" title={task.source}>{task.label}</td>
                    <td className="dashboard-task-state"><span className={"badge " + (task.state === "OVERDUE" ? "critical" : "warning")}>{task.state === "OVERDUE" ? "Vencida" : "Próxima"}</span></td>
                  </tr>
                ))}
                {!data.tasks.length && <tr><td colSpan={4} className="dashboard-empty">No hay plazos vencidos ni próximos con estos filtros. Esto no confirma que no existan otras acciones pendientes.</td></tr>}
              </tbody>
            </table>
          </div>
          <nav className="dashboard-pagination" aria-label="Páginas de plazos">
            <span>{number(data.taskCounts.total)} plazos · Página {data.page} de {data.pageCount}</span>
            <div>
            {data.page > 1 && <Link className="button small" href={queryLink(query, data.page - 1)}>Anterior</Link>}
            {data.page < data.pageCount && <Link className="button small" href={queryLink(query, data.page + 1)}>Siguiente</Link>}
            </div>
          </nav>
        </section>

        <section className="dashboard-section dashboard-trend-section" aria-labelledby="dashboard-trend-title">
          <div className="dashboard-heading"><div><p className="eyebrow">KPI históricos</p><h2 id="dashboard-trend-title">Evolución de 5 años</h2></div></div>
          {data.trend.length ? <>
            <p className="dashboard-trend-module">{moduleName(selectedModule as DashboardModule)} <span>Expedientes por año de apertura</span></p>
            <p className="dashboard-hint">Hasta {year ?? now.getUTCFullYear()} · los años sin cobertura no equivalen a cero.</p>
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
          <div className="dashboard-footnote">El recuento por año de apertura no coincide con los indicadores por fecha de cierre o de eficacia. Consulta cada módulo para sus definiciones.</div>
        </section>
      </div>

      <p className="dashboard-source-note" title={`Consulta: ${data.elapsedMs} ms`}>Datos a {date(data.asOf)} · el panel solo consulta: no registra ni modifica expedientes.</p>
    </section>
  );
}

export default async function HomePage(...args: Parameters<typeof HomePageAuthenticatedContent>) {
  return authorizedPage("src/app/page.tsx", () => HomePageAuthenticatedContent(...args), args);
}
