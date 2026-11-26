import { PermissionGate } from "@/components/permissions";
import { requireUser } from "@/lib/auth/session";
import { appUserOptions } from "@/lib/auth/app-users";
import { administrativeToday } from "@/lib/qms/administrative-date";
import { prisma } from "@/lib/db";
import { displayDate, revisionLabels } from "../domain";
import { readingDueDate, readingSummary } from "./domain";
import { getDocumentReadings, type DocumentReading } from "./queries";
import { addReadersAction, confirmOwnReadingAction, confirmReadingForOtherAction, requestPreviousReadersAction, requestRereadAction, withdrawReadingAction } from "./actions";
import { ReaderPicker, ReadingActionForm } from "./forms";

/** D-141: pestaña «Lectura» del PNT. Control operativo; la firma de lectura sigue en el procedimiento. */
const stateLabels: Record<DocumentReading["state"], string> = { PENDING: "Pendiente", READ: "Leído", WITHDRAWN: "Retirada", SUPERSEDED: "Sin leer · revisión sustituida" };
const day = (value: string | null) => value ? displayDate(new Date(`${value}T00:00:00Z`)) : "—";
// Instantes como día de Madrid (FEC1), igual que las fechas administrativas.
const instant = (value: Date | null) => value ? displayDate(administrativeToday(value)) : "—";
const stateOrder: Record<DocumentReading["state"], number> = { PENDING: 0, READ: 1, SUPERSEDED: 2, WITHDRAWN: 3 };

function ReadingRow({ row, documentId, me, today, due, annulled }: { row: DocumentReading; documentId: string; me: string | undefined; today: string; due: string; annulled: boolean }) {
  const overdue = row.state === "PENDING" && row.dueDate < today;
  const own = Boolean(me) && row.readerUserId === me;
  return <tr data-reading-id={row.id}>
    <td>{row.readerName}{row.external ? <span className="badge neutral">Externa</span> : null}{row.inactive ? <span className="badge neutral">Usuario inactivo</span> : null}</td>
    <td><span className={`badge ${row.state === "READ" ? "closed" : overdue ? "nonconforming" : "neutral"}`}>{stateLabels[row.state]}{overdue ? " · vencida" : ""}</span>
      {row.state === "WITHDRAWN" && row.withdrawalReason ? <small className="muted-note">{row.withdrawalReason} ({row.withdrawnByText})</small> : null}</td>
    <td>{instant(row.assignedAt)}<small className="muted-note">{row.assignedByText}</small></td>
    <td>{day(row.dueDate)}</td>
    <td>{day(row.readOn)}{row.confirmedByText ? <small className="muted-note">{row.confirmedOnBehalf ? `Confirmada por ${row.confirmedByText}` : "Marcada por la persona"}</small> : null}</td>
    <td>{row.readCount}</td>
    <td className="reading-actions">{annulled ? null : <>
      {row.state === "PENDING" && own ? <PermissionGate permission="PNT_READING_SELF"><ReadingActionForm action={confirmOwnReadingAction.bind(null, documentId)} submitLabel="Marcar como leído">
        <input type="hidden" name="readingId" value={row.id} /><label className="field compact"><span>Leído el</span><input type="date" name="readOn" defaultValue={today} max={today} required /></label>
      </ReadingActionForm></PermissionGate> : null}
      {row.state === "PENDING" && !own ? <PermissionGate permission="PNT_READING_CONFIRM"><ReadingActionForm action={confirmReadingForOtherAction.bind(null, documentId)} submitLabel="Confirmar lectura">
        <input type="hidden" name="readingId" value={row.id} /><label className="field compact"><span>Leído el</span><input type="date" name="readOn" defaultValue={today} max={today} required /></label>
      </ReadingActionForm></PermissionGate> : null}
      {row.state === "READ" && !row.inactive ? <PermissionGate permission="EDIT"><details className="reading-more"><summary>Enviar a relectura</summary><ReadingActionForm action={requestRereadAction.bind(null, documentId)} submitLabel="Enviar a relectura">
        <input type="hidden" name="readingId" value={row.id} /><label className="field compact"><span>Plazo</span><input type="date" name="dueDate" defaultValue={due} min={today} required /></label>
      </ReadingActionForm></details></PermissionGate> : null}
      {row.state === "PENDING" ? <PermissionGate permission="EDIT"><details className="reading-more"><summary>Retirar</summary><ReadingActionForm action={withdrawReadingAction.bind(null, documentId)} submitLabel="Retirar lectura" danger>
        <input type="hidden" name="readingId" value={row.id} /><label className="field compact"><span>Motivo</span><input name="reason" required maxLength={2000} /></label>
      </ReadingActionForm></details></PermissionGate> : null}
    </>}</td>
  </tr>;
}

function ReadingsTable({ rows, ...props }: { rows: DocumentReading[]; documentId: string; me: string | undefined; today: string; due: string; annulled: boolean }) {
  if (!rows.length) return <p className="muted-note">Nadie tiene pedida la lectura de esta revisión.</p>;
  const sorted = [...rows].sort((a, b) => stateOrder[a.state] - stateOrder[b.state] || a.readerName.localeCompare(b.readerName, "es"));
  return <div className="table-scroll"><table className="data-table reading-table">
    <thead><tr><th>Persona</th><th>Estado</th><th>Pedida</th><th>Plazo</th><th>Leído</th><th title="Lecturas confirmadas de esta persona en el PNT, en todas sus revisiones">Lecturas</th><th>Acciones</th></tr></thead>
    <tbody>{sorted.map(row => <ReadingRow key={row.id} row={row} {...props} />)}</tbody>
  </table></div>;
}

export async function ReadingsPanel({ documentId, annulled }: { documentId: string; annulled: boolean }) {
  const today = administrativeToday(), due = readingDueDate(today);
  // El panel se renderiza fuera del contexto de la página: la identidad sale de la sesión.
  const me = (await requireUser()).id;
  const [{ readable, readings }, users, departments] = await Promise.all([
    getDocumentReadings(documentId),
    appUserOptions(),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);
  const summary = readingSummary(readings, today);
  const readableIds = new Set(readable.map(revision => revision.id));
  const older = readings.filter(row => !readableIds.has(row.revisionId));
  return <section className="card pnt-readings-panel">
    <div className="page-heading"><h2>Lectura</h2></div>
    <p className="section-help">Quién debe leer el PNT y quién lo tiene pendiente. Es un control de por dónde va el documento: la firma de lectura sigue en el procedimiento.</p>
    <p className="reading-summary" data-testid="reading-summary">{summary.pending ? <strong>En lectura: {summary.pending} pendiente{summary.pending === 1 ? "" : "s"}{summary.overdue ? ` (${summary.overdue} vencida${summary.overdue === 1 ? "" : "s"})` : ""}</strong> : "Sin lecturas pendientes."} · {summary.read} lectura{summary.read === 1 ? "" : "s"} confirmada{summary.read === 1 ? "" : "s"}.</p>
    {!readable.length ? <div className="empty-panel">Las lecturas se piden de la revisión vigente o de la aprobada pendiente de vigencia; este PNT no tiene ninguna.</div> : null}
    {readable.map(revision => <div key={revision.id} className="reading-revision">
      <h3>Revisión {revision.revisionCode} · {revisionLabels[revision.status]}</h3>
      <ReadingsTable rows={readings.filter(row => row.revisionId === revision.id)} documentId={documentId} me={me} today={today} due={due} annulled={annulled} />
      {annulled ? null : <PermissionGate permission="EDIT" form>
        <div className="reading-tools">
          <details className="reading-add"><summary className="button small">Añadir personas</summary>
            <ReadingActionForm action={addReadersAction.bind(null, documentId)} submitLabel="Pedir lectura" className="form-stack">
              <input type="hidden" name="revisionId" value={revision.id} />
              <ReaderPicker users={users.filter(user => user.active).map(user => ({ id: user.id, name: user.name }))} departments={departments} />
              <label className="field compact"><span>Plazo</span><input type="date" name="dueDate" defaultValue={due} min={today} required /></label>
            </ReadingActionForm>
          </details>
          {revision.previousReaders ? <ReadingActionForm action={requestPreviousReadersAction.bind(null, documentId)} submitLabel={`Pedir lectura a los lectores anteriores (${revision.previousReaders})`}>
            <input type="hidden" name="revisionId" value={revision.id} /><label className="field compact"><span>Plazo</span><input type="date" name="dueDate" defaultValue={due} min={today} required /></label>
          </ReadingActionForm> : null}
        </div>
      </PermissionGate>}
    </div>)}
    {older.length ? <details className="reading-older"><summary>Lecturas de revisiones anteriores ({older.length})</summary>
      {[...new Set(older.map(row => row.revisionCode))].map(code => <div key={code}><h4>Revisión {code}</h4>
        <ReadingsTable rows={older.filter(row => row.revisionCode === code)} documentId={documentId} me={me} today={today} due={due} annulled />
      </div>)}
    </details> : null}
  </section>;
}
