import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getProgrammePreview, listProgrammeVersions } from "./service";
import { ProgrammeApproversForm, ProgrammeIssueForm } from "./forms";
import { externalProgrammeNotes } from "./domain";
export async function AnnualProgrammePanel({ planId }: { planId: string }) {
  const [preview, versions] = await Promise.all([getProgrammePreview(planId), listProgrammeVersions(planId)]);
  const c = preview.content, internal = c.auditType === "INTERNAL";
  return <section className="card" aria-labelledby="annual-programme-title">
    <h2 id="annual-programme-title">Programa Anual · emisión documental</h2>
    <p>{c.reference} · {c.year}. Se incluyen las entradas activas planificadas y las fechas de ejecución confirmadas disponibles al emitir. Las auditorías fuera de plan quedan excluidas.</p>
    <p>La secuencia 00, 01… identifica emisiones del Programa Anual. No revisa el Plan Maestro. Si el cambio de planificación requiere revisarlo conforme al procedimiento vigente, tramítalo por la vía documental correspondiente antes de emitir.</p>
    <p>Word editable. Firmas y fechas de aprobación pendientes de cumplimentación manual.</p>
    <details><summary>Datos de aprobación del programa</summary><ProgrammeApproversForm planId={planId} internal={internal} technical={c.technicalApproverName} quality={c.qualityApproverName}/></details>
    <h3>Contenido a emitir</h3>
    <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Entidad / departamento</th><th>Fecha / período previsto</th><th>Auditores previstos</th><th>Realización</th><th>{internal ? "Cierre parcial" : "Observaciones / cierre parcial"}</th>{internal && <th>Observaciones</th>}</tr></thead><tbody>
      {c.rows.map(r => <tr key={r.entryId}><td>{r.target || "Pendiente"}{!internal && <><br/>{[r.area, r.productService, r.scope].filter(Boolean).join(" · ")}</>}</td><td>{r.planned || "Pendiente"}</td><td>{r.auditors || "Pendiente"}</td><td>{r.performed || "—"}</td><td>{internal ? r.partial || "—" : externalProgrammeNotes(r) || "—"}</td>{internal && <td>{r.notes || "—"}</td>}</tr>)}
    </tbody></table></div>
    {preview.blockers.length > 0 && <div><p><strong>Para emitir:</strong></p><ul>{preview.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul></div>}
    {c.warnings.length > 0 && <div><p><strong>Comprobaciones del contenido:</strong></p><ul>{c.warnings.map((b, i) => <li key={i}>{b}</li>)}</ul></div>}
    {versions[0] && <p>{versions[0].contentFingerprint === preview.fingerprint ? "El contenido actual coincide con la última emisión." : "El contenido o la plantilla han cambiado desde la última emisión. El archivo histórico se conserva."}</p>}
    <ProgrammeIssueForm key={versions[0]?.id || "initial"} planId={planId} fingerprint={preview.fingerprint} requestId={randomUUID()} blocked={preview.blockers.length > 0} subsequent={versions.length > 0}/>
    <h3>Histórico de emisiones</h3>
    {!versions.length ? <p>Aún no se ha emitido el programa.</p> : <ol className="audit-history">{versions.map(v => <li key={v.id}>
      <strong>Emisión {String(v.sequenceNumber).padStart(2, "0")}</strong><p>{v.reason}</p><p>{v.generatedBy} · {v.generatedAt.toISOString()} · {v.reference}</p>
      <Link className="button small" href={`/api/audits/plans/${planId}/programmes/${v.id}`}>Descargar {v.fileName}</Link>
      <details><summary>Integridad del archivo</summary><code style={{ overflowWrap: "anywhere" }}>{v.checksum}</code></details>
    </li>)}</ol>}
  </section>;
}
