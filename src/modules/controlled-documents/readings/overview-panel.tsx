import Link from "next/link";
import { PermissionGate } from "@/components/permissions";
import { requireUser } from "@/lib/auth/session";
import { appUserOptions } from "@/lib/auth/app-users";
import { administrativeToday } from "@/lib/qms/administrative-date";
import { prisma } from "@/lib/db";
import { displayDate } from "../domain";
import { readingDueDate } from "./domain";
import { assignableCandidates, canAssignSomeReading, groupPendingReadings, type OverviewFilters } from "./overview";
import type { Principal } from "@/lib/auth/context";
import { OVERVIEW_ROW_LIMIT, bulkReadingCandidates, pendingReadingsOverview, type OverviewReading } from "./queries";
import { confirmOwnReadingAction, confirmReadingForOtherAction } from "./actions";
import { ReadingActionForm } from "./forms";
import { BulkReadingForm } from "./bulk-form";

/** D-141, entrega 2: página «Lecturas de PNT»: lecturas pendientes de todos los PNT y asignación masiva. */
const day = (value: string) => displayDate(new Date(`${value}T00:00:00Z`));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function href(filters: OverviewFilters, change: Partial<OverviewFilters>) {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.view !== "pending") params.set("view", next.view);
  if (next.group !== "person") params.set("group", next.group);
  for (const key of ["person", "q", "department"] as const) if (next[key]) params.set(key, next[key]);
  if (next.overdue) params.set("overdue", "1");
  const query = params.toString();
  return `/controlled-documents/readings${query ? `?${query}` : ""}`;
}

function Actions({ row, me, today }: { row: OverviewReading; me: string; today: string }) {
  const own = row.readerUserId === me;
  const date = <><input type="hidden" name="readingId" value={row.id} /><input type="hidden" name="readOn" value={today} /></>;
  return own
    ? <PermissionGate permission="PNT_READING_SELF" module="PNT"><ReadingActionForm action={confirmOwnReadingAction.bind(null, row.documentId)} submitLabel="Marcar como leído">{date}</ReadingActionForm></PermissionGate>
    : <PermissionGate permission="PNT_READING_CONFIRM" module="PNT"><ReadingActionForm action={confirmReadingForOtherAction.bind(null, row.documentId)} submitLabel="Confirmar lectura">{date}</ReadingActionForm></PermissionGate>;
}

export async function ReadingsOverview({ filters }: { filters: OverviewFilters }) {
  const today = administrativeToday();
  const user = await requireUser(), me = user.id;
  const canAssign = canAssignSomeReading(user);
  const departments = await prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });
  return <section className="workspace pnt-readings-overview">
    <header className="page-heading pnt-hero"><div><p className="eyebrow">GESTIÓN DOCUMENTAL · PNT</p><h1>Lecturas de PNT</h1><p className="muted-note">Quién tiene pendiente la lectura de cada PNT. Control operativo: la firma de lectura sigue en el procedimiento.</p></div>
      <div className="heading-actions"><Link className="button" href="/controlled-documents">Volver a la biblioteca</Link></div></header>
    <nav className="record-tabs pnt-record-tabs" aria-label="Lecturas">
      <Link className={filters.view === "pending" ? "active" : ""} aria-current={filters.view === "pending" ? "page" : undefined} href={href(filters, { view: "pending" })}>Pendientes</Link>
      <PermissionGate permission="EDIT" allowed={canAssign}><Link className={filters.view === "assign" ? "active" : ""} aria-current={filters.view === "assign" ? "page" : undefined} href={href(filters, { view: "assign" })}>Asignar lecturas</Link></PermissionGate>
    </nav>
    {filters.view === "assign" ? <Assign user={user} today={today} departments={departments} /> : <Pending filters={filters} today={today} me={me} departments={departments} />}
  </section>;
}

async function Assign({ user, today, departments }: { user: Principal; today: string; departments: Array<{ id: string; code: string; name: string }> }) {
  // Sin permiso no se consulta nada; con ámbito, solo los PNT que la persona puede editar (el servidor lo repite).
  if (!canAssignSomeReading(user)) return <p className="empty-panel">Pedir lecturas exige poder editar los PNT.</p>;
  const candidates = assignableCandidates(user, await bulkReadingCandidates());
  if (!candidates.length) return <p className="empty-panel">No puedes editar ningún PNT con revisión vigente o aprobada pendiente de vigencia.</p>;
  const users = await appUserOptions();
  return <section className="card pnt-readings-panel">
    <h2>Asignar lecturas</h2>
    <p className="section-help">Elige los PNT, qué revisión se lee y a quién se pide. Cada lectura queda en la pestaña «Lectura» de su PNT. Solo aparecen los PNT que puedes editar. Se guardan todas las lecturas o ninguna.</p>
    <BulkReadingForm candidates={candidates} departments={departments} users={users.filter(option => option.active).map(option => ({ id: option.id, name: option.name }))} today={today} due={readingDueDate(today)} />
  </section>;
}

async function Pending({ filters, today, me, departments }: { filters: OverviewFilters; today: string; me: string; departments: Array<{ id: string; code: string; name: string }> }) {
  const { rows, total, overdue, people, documentCount, personCount } = await pendingReadingsOverview(filters, today);
  const groups = groupPendingReadings(rows, filters.group, today);
  const byPerson = filters.group === "person";
  const filtered = Boolean(filters.person || filters.q || filters.department || filters.overdue);
  return <>
    <p className="pnt-summary list-counters" data-testid="readings-overview-summary">
      <span><strong>{total}</strong> {total === 1 ? "lectura pendiente" : "lecturas pendientes"}</span>
      <span><strong>{overdue}</strong> {overdue === 1 ? "vencida" : "vencidas"}</span>
      <span><strong>{personCount}</strong> {personCount === 1 ? "persona" : "personas"}</span>
      <span><strong>{documentCount}</strong> PNT</span>
    </p>
    <section className="pnt-filter-card">
      <form className="filter-panel pnt-filters" method="get">
        <div className="reading-filters">
          <label className="field"><span>Agrupar por</span><select name="group" defaultValue={filters.group}><option value="person">Persona</option><option value="pnt">PNT</option></select></label>
          <label className="field"><span>Persona</span><select name="person" defaultValue={filters.person}><option value="">Todas</option>{people.map(p => <option key={p.key} value={p.key}>{p.name}{p.external ? " (externa)" : ""}</option>)}</select></label>
          <label className="field"><span>PNT</span><input name="q" defaultValue={filters.q} placeholder="Código o título" /></label>
          <label className="field"><span>Departamento del PNT</span><select name="department" defaultValue={filters.department}><option value="">Todos</option>{departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
          <label className="check-option"><input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdue} /> Solo vencidas</label>
          <div className="filter-actions"><button className="button primary" type="submit">Aplicar filtros</button><Link className="button" href="/controlled-documents/readings">Limpiar</Link></div>
        </div>
      </form>
    </section>
    {total > rows.length ? <p className="form-feedback" role="status">Se muestran las {OVERVIEW_ROW_LIMIT} con el plazo más próximo de {total}; acota con los filtros.</p> : null}
    {!groups.length ? <div className="empty-panel">{filtered ? "Ninguna lectura pendiente con estos filtros." : "No hay lecturas pendientes."}</div> : null}
    {groups.map(group => <section key={group.key} className="card pnt-readings-panel reading-group" data-reading-group={group.label}>
      <h2>{byPerson ? group.label : <Link href={`/controlled-documents/${group.rows[0].documentId}?tab=readings`}>{group.label}</Link>}
        {group.external ? <span className="badge neutral">Externa</span> : null}
        <small className="muted-note"> · {plural(group.rows.length, "pendiente", "pendientes")}{group.overdue ? ` · ${plural(group.overdue, "vencida", "vencidas")}` : ""}</small></h2>
      {!byPerson ? <p className="muted-note">{group.rows[0].title}</p> : null}
      <div className="table-scroll"><table className="data-table reading-table">
        <thead><tr>{byPerson ? <th>PNT</th> : <th>Persona</th>}<th>Revisión</th><th>Pedida</th><th>Plazo</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{group.rows.map(row => {
          const late = row.dueDate < today;
          return <tr key={row.id} data-reading-id={row.id}>
            <td>{byPerson ? <><Link href={`/controlled-documents/${row.documentId}?tab=readings`}>{row.baseCode}</Link><small className="muted-note">{row.title}</small></> : <>{row.readerName}{row.readerUserId ? null : <span className="badge neutral">Externa</span>}</>}</td>
            <td>{row.revisionCode}</td>
            <td>{displayDate(administrativeToday(row.assignedAt))}<small className="muted-note">{row.assignedByText}</small></td>
            <td>{day(row.dueDate)}</td>
            <td><span className={`badge ${late ? "nonconforming" : "neutral"}`}>{late ? "Pendiente · vencida" : "Pendiente"}</span></td>
            <td className="reading-actions"><Actions row={row} me={me} today={today} /></td>
          </tr>;
        })}</tbody>
      </table></div>
    </section>)}
  </>;
}
