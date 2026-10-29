import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page-guard";
import { currentIdentity } from "@/lib/auth/context";
import { prisma } from "@/lib/db";
import { DASHBOARD_ALL_MODULES } from "@/modules/dashboard/domain";
import { calendarDayKey, calendarRange, calendarTitle, groupByDay, parseCalendarQuery, shiftAnchor, type CalendarItem, type CalendarQuery } from "@/modules/dashboard/calendar-domain";
import { getCalendarItems } from "@/modules/dashboard/calendar-query";
import "./calendar.css";

export const dynamic = "force-dynamic";

const modules = DASHBOARD_ALL_MODULES;
const moduleLabel = Object.fromEntries(modules.map((m) => [m.key, m.label])) as Record<string, string>;
const weekdays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_CELL_LIMIT = 4;
const longDay = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function href(query: CalendarQuery, changes: Partial<Record<"view" | "date" | "module" | "department" | "scope", string>> = {}) {
  const values: Record<string, string> = {
    view: query.view, date: calendarDayKey(query.anchor),
    module: query.module === "ALL" ? "" : query.module, department: query.department, scope: query.scope === "mine" ? "mine" : "",
    ...changes,
  };
  const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
  return "/calendar?" + params.toString();
}

function Entry({ item }: { item: CalendarItem }) {
  return <Link className={`calendar-item calendar-module-${item.module.toLowerCase()}${item.overdue ? " is-overdue" : ""}`} href={item.href} title={`${moduleLabel[item.module]} · ${item.code} · ${item.label} — ${item.detail}`}>
    {item.overdue && <em className="calendar-overdue-tag">Vencida</em>}<strong>{item.code}</strong> <span>{item.label}</span>
  </Link>;
}

async function CalendarPageAuthenticatedContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const now = new Date();
  const query = parseCalendarQuery(await searchParams, now, modules.map((m) => m.key));
  const range = calendarRange(query.view, query.anchor);
  const [result, departments] = await Promise.all([
    getCalendarItems(query, range, currentIdentity()?.principal.id, now),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const groups = groupByDay(result.items);
  const today = calendarDayKey(now);
  const month = query.anchor.getUTCMonth();
  const weeks = Array.from({ length: range.days.length / 7 }, (_, index) => range.days.slice(index * 7, index * 7 + 7));
  const overdue = result.items.filter((item) => item.overdue).length;

  return (
    <section className="workspace calendar-workspace" data-testid="qms-calendar">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Plazos del Sistema de Calidad</p>
          <h1>Calendario</h1>
          <p className="muted-note">Seguimientos, ejecuciones, revisiones y acciones pendientes con fecha prevista. Pulsa un plazo para abrir su expediente.</p>
        </div>
        <Link className="button" href="/">Volver al inicio</Link>
      </header>

      <form method="get" className="filter-panel calendar-filters" aria-label="Filtros del calendario">
        <input type="hidden" name="date" value={calendarDayKey(query.anchor)} />
        <label className="field"><span>Vista</span>
          <select name="view" defaultValue={query.view}><option value="month">Mes</option><option value="week">Semana</option></select>
        </label>
        <label className="field"><span>Mostrar</span>
          <select name="scope" defaultValue={query.scope}><option value="all">Todos los plazos</option><option value="mine">Solo mis tareas</option></select>
        </label>
        <label className="field"><span>Área</span>
          <select name="module" defaultValue={query.module}>
            <option value="ALL">Todos los módulos</option>
            {modules.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </label>
        <label className="field"><span>Departamento</span>
          <select name="department" defaultValue={query.department}>
            <option value="">Todos</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
          </select>
        </label>
        <div className="filter-actions"><button className="button primary" type="submit">Aplicar</button><Link className="button" href="/calendar">Limpiar</Link></div>
      </form>

      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <Link className="button small" href={href(query, { date: calendarDayKey(shiftAnchor(query.view, query.anchor, -1)) })} aria-label={query.view === "week" ? "Semana anterior" : "Mes anterior"}>← Anterior</Link>
          <Link className="button small" href={href(query, { date: today })}>Hoy</Link>
          <Link className="button small" href={href(query, { date: calendarDayKey(shiftAnchor(query.view, query.anchor, 1)) })} aria-label={query.view === "week" ? "Semana siguiente" : "Mes siguiente"}>Siguiente →</Link>
        </div>
        <h2 className="calendar-title">{calendarTitle(query.view, query.anchor)}</h2>
        <p className="calendar-summary" aria-live="polite"><strong>{result.items.length}</strong> plazos en pantalla{overdue ? <> · <strong className="calendar-summary-overdue">{overdue}</strong> vencidos</> : null}</p>
      </div>

      {query.scope === "mine"
        ? <p className="section-help">Tus tareas de «Mis tareas» con fecha prevista.{result.undated ? ` ${result.undated} sin fecha no aparecen en el calendario.` : ""}{result.overdueBefore ? ` ${result.overdueBefore} vencidas antes de este periodo.` : ""} <Link href="/?tasks=mine#dashboard-tasks">Ver «Mis tareas»</Link></p>
        : <p className="section-help">Lo vencido antes de este periodo sigue en los plazos del panel. <Link href="/?tasks=overdue#dashboard-tasks">Ver plazos vencidos</Link></p>}

      <div className={`calendar-grid calendar-view-${query.view}`} role="table" aria-label={calendarTitle(query.view, query.anchor)}>
        <div className="calendar-weekdays" role="row">{weekdays.map((day) => <div key={day} role="columnheader">{day}</div>)}</div>
        {weeks.map((week) => <div className="calendar-week" role="row" key={calendarDayKey(week[0])}>
          {week.map((day) => {
            const key = calendarDayKey(day), items = groups.get(key) ?? [];
            const shown = query.view === "month" ? items.slice(0, MONTH_CELL_LIMIT) : items;
            const outside = query.view === "month" && day.getUTCMonth() !== month;
            return <div role="cell" key={key} className={`calendar-day${outside ? " is-outside" : ""}${key === today ? " is-today" : ""}`} aria-current={key === today ? "date" : undefined}>
              <span className="calendar-day-number" aria-hidden="true">{day.getUTCDate()}</span>
              <span className="visually-hidden">{longDay.format(day)}{items.length ? `: ${items.length} plazos` : ""}</span>
              {shown.map((item) => <Entry key={item.key} item={item} />)}
              {items.length > shown.length && <Link className="calendar-more" href={href(query, { view: "week", date: key })}>+{items.length - shown.length} más</Link>}
            </div>;
          })}
        </div>)}
      </div>

      <section className="calendar-agenda" aria-label="Plazos por día">
        {!result.items.length && <p className="muted-note">No hay plazos en este periodo con estos filtros.</p>}
        {[...groups.entries()].map(([key, items]) => <div className="calendar-agenda-day" key={key}>
          <h3>{longDay.format(new Date(`${key}T00:00:00Z`)).replace(/^./, (c) => c.toUpperCase())}</h3>
          {items.map((item) => <Entry key={item.key} item={item} />)}
        </div>)}
      </section>

      <ul className="calendar-legend" aria-label="Leyenda">
        {modules.map((m) => <li key={m.key} className={`calendar-module-${m.key.toLowerCase()}`}>{m.label}</li>)}
        <li className="is-overdue">Vencida</li>
      </ul>
    </section>
  );
}

export default async function CalendarPage(...args: Parameters<typeof CalendarPageAuthenticatedContent>) {
  return authorizedPage("src/app/calendar/page.tsx", () => CalendarPageAuthenticatedContent(...args), args);
}
