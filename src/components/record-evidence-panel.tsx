import { PermissionGate } from "@/components/permissions";
import { RecordEvidenceForm } from "@/components/record-evidence-form";
import { listRecordEvidence } from "@/lib/qms/record-evidence";
import type { RecordEvidenceState } from "@/lib/qms/record-evidence-actions";

const formatDateTime = (value: Date) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
const formatSize = (size: number | null) =>
  size === null ? "—" : size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;

/** Pestaña «Evidencias»: archivos adjuntos al expediente (D-096). Solo se añaden; no se sustituyen ni borran. */
export async function RecordEvidencePanel({
  qmsRecordId,
  active,
  action,
}: {
  qmsRecordId: string;
  active: boolean;
  action: (state: RecordEvidenceState, formData: FormData) => Promise<RecordEvidenceState>;
}) {
  const items = await listRecordEvidence(qmsRecordId);
  return (
    <div className="card evidence-card">
      <h2>Evidencias adjuntas</h2>
      <p className="muted-note">
        Fotografías, registros, certificados u otros archivos que respaldan el expediente. Cada evidencia se conserva tal como se
        adjuntó, con su huella SHA-256: no se sustituye ni se borra. No se imprime en los anexos.
      </p>
      {items.length ? (
        <div className="table-scroll">
          <table className="records-table compact-table evidence-table">
            <thead>
              <tr><th>Archivo</th><th>Descripción</th><th>Referencia</th><th>Tamaño</th><th>Adjuntado</th></tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <PermissionGate permission="DOWNLOAD" fallback={<span>{item.fileName ?? "evidencia"}</span>}>
                      <a href={`/api/qms/${qmsRecordId}/evidence/${item.id}`}>{item.fileName ?? "evidencia"}</a>
                    </PermissionGate>
                    <small className="muted-note evidence-checksum" title={item.checksum ?? undefined}>SHA-256 {item.checksum?.slice(0, 12) ?? "—"}…</small>
                  </td>
                  <td>{item.description || "—"}</td>
                  <td>{item.reference ?? "—"}</td>
                  <td>{formatSize(item.size)}</td>
                  <td>{formatDateTime(item.generatedAt)}<br /><small className="muted-note">{item.generatedByText ?? "Usuario no informado"}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty-panel">Este expediente no tiene evidencias adjuntas.</div>}
      {active ? (
        <PermissionGate permission="ATTACH_DOCUMENT">
          <h3>Adjuntar evidencia</h3>
          <RecordEvidenceForm action={action} />
        </PermissionGate>
      ) : <p className="muted-note">El expediente está anulado: no admite nuevas evidencias.</p>}
    </div>
  );
}
