import { PermissionGate } from "@/components/permissions";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getProgrammePreview, listProgrammeVersions } from "./service";
import { ProgrammeApproversForm, ProgrammeIssueForm } from "./forms";
import { externalProgrammeNotes } from "./domain";
export async function AnnualProgrammePanel({ planId }: { planId: string }) {
  const [preview, versions] = await Promise.all([getProgrammePreview(planId), listProgrammeVersions(planId)]);
  const c = preview.content, internal = c.auditType === "INTERNAL", annexV = c.format === "ANNEX_V";
  const nextVersion = String(versions.length ? versions[0].sequenceNumber + 1 : 0).padStart(2, "0");
  return <section className="card" aria-labelledby="annual-programme-title">
    <h2 id="annual-programme-title">Programa Anual · versiones</h2>
    <p>{c.reference} · {c.year}. Se incluyen las entradas planificadas con el código, la fecha de auditoría y la fecha de cierre parcial (CAPA plan 00) disponibles al emitir. Las auditorías fuera de plan quedan excluidas.</p>
    {annexV
      ? <p>Cada versión (00, 01…) se emite a mano con «Nueva versión» y recoge los datos de ese momento. Las entradas retiradas después de publicarse siguen como canceladas con su motivo; las reprogramadas indican la fecha prevista inicial.</p>
      : <p>Plantilla anterior del Plan Maestro: la secuencia 00, 01… identifica emisiones del Programa Anual.</p>}
    <p>Word editable. Firmas y fechas pendientes de cumplimentación manual.</p>
    <PermissionGate permission="EDIT"><details><summary>Firmantes del programa</summary><ProgrammeApproversForm planId={planId} internal={internal} legacy={!annexV} prepared={c.preparedByName} technical={c.technicalApproverName} quality={c.qualityApproverName}/></details></PermissionGate>
    <h3>Contenido de la versión {nextVersion}</h3>
    <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Nº</th><th>{internal ? "Área y alcance" : "Entidad y alcance"}</th><th>Fecha prevista</th><th>Equipo auditor</th><th>Código de auditoría</th><th>Fecha de auditoría</th><th>{internal ? "Fecha de cierre parcial" : "Fecha cierre parcial"}</th><th>Comentarios</th></tr></thead><tbody>
      {c.rows.map((r, i) => <tr key={r.entryId}><td>{i + 1}</td><td>{r.target || "Pendiente"}{(internal ? [r.scope] : [r.area && `Ámbito: ${r.area}`, r.productService, r.scope]).filter(Boolean).map((v, j) => <span key={j}><br/>{v}</span>)}</td><td>{r.planned || "Pendiente"}</td><td>{r.auditors || "Pendiente"}</td><td>{r.code || "—"}</td><td>{r.performed || "—"}</td><td>{r.partial || "—"}</td><td style={{ whiteSpace: "pre-line" }}>{(annexV ? r.comments : internal ? r.notes : externalProgrammeNotes(r)) || "—"}</td></tr>)}
    </tbody></table></div>
    {preview.blockers.length > 0 && <div><p><strong>Para emitir:</strong></p><ul>{preview.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul></div>}
    {c.warnings.length > 0 && <div><p><strong>Comprobaciones del contenido:</strong></p><ul>{c.warnings.map((b, i) => <li key={i}>{b}</li>)}</ul></div>}
    {versions[0] ? versions[0].contentFingerprint === preview.fingerprint
      ? <p>El contenido actual coincide con la versión {String(versions[0].sequenceNumber).padStart(2, "0")}.</p>
      : <div><p><strong>Cambios respecto a la versión {String(versions[0].sequenceNumber).padStart(2, "0")}:</strong></p>{preview.changes.length ? <ul>{preview.changes.map((change, i) => <li key={i}>{change}</li>)}</ul> : <p>Cambia la plantilla o un dato que no se muestra en la tabla. El archivo anterior se conserva.</p>}</div> : null}
    <PermissionGate permission="AUDIT_ISSUE_PROGRAMME"><ProgrammeIssueForm key={versions[0]?.id || "initial"} planId={planId} fingerprint={preview.fingerprint} requestId={randomUUID()} blocked={preview.blockers.length > 0} subsequent={versions.length > 0} nextVersion={nextVersion}/></PermissionGate>
    <h3>Histórico de versiones</h3>
    {!versions.length ? <p>Aún no se ha emitido el programa.</p> : <ol className="audit-history">{versions.map(v => <li key={v.id}>
      <strong>Versión {String(v.sequenceNumber).padStart(2, "0")}</strong><p>{v.reason}</p><p>{v.generatedBy} · {v.generatedAt.toISOString()} · {v.reference}</p>
      <PermissionGate permission="DOWNLOAD"><Link className="button small" href={`/api/audits/plans/${planId}/programmes/${v.id}`}>Descargar {v.fileName}</Link></PermissionGate>
      <details><summary>Integridad del archivo</summary><code style={{ overflowWrap: "anywhere" }}>{v.checksum}</code></details>
    </li>)}</ol>}
  </section>;
}
