import { getRecordTimeline, TIMELINE_KIND_LABELS, TIMELINE_LIMIT_PER_SOURCE } from "@/lib/qms/timeline";

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);

/** Pestaña «Cronología»: vista combinada de solo lectura, con el mismo marcado que «Historial». */
export async function RecordTimeline({ qmsRecordId }: { qmsRecordId: string }) {
  const entries = await getRecordTimeline(qmsRecordId);
  return (
    <div className="card">
      <h2>Cronología del expediente</h2>
      <p className="muted-note">
        Vista combinada de modificaciones, versiones y seguimientos, documentos y relaciones, de la más reciente a la más antigua.
        Es historial operativo de consulta: no constituye un audit trail GMP validado, que se consulta en la pestaña Audit Trail.
        Muestra hasta {TIMELINE_LIMIT_PER_SOURCE} entradas de cada tipo.
      </p>
      {entries.length ? (
        <div className="timeline">
          {entries.map((entry) => (
            <div className="timeline-item history-entry" key={entry.id}>
              <header className="history-entry-header">
                <strong>{formatDateTime(entry.at)}</strong>
                <span>{entry.actor ?? "Sistema"}</span>
                <span className="badge neutral">{TIMELINE_KIND_LABELS[entry.kind]}</span>
              </header>
              <p className="history-entry-detail">
                <strong>{entry.title}</strong>
                {entry.detail ? <span> · {entry.detail}</span> : null}
              </p>
            </div>
          ))}
        </div>
      ) : <div className="empty-panel">Sin actividad registrada.</div>}
    </div>
  );
}
