import { sessionLifecyclePrincipal } from "../documents/session-access";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { displayDate, revisionLabels } from "../domain";
import { metadataSelection } from "../documents/service";
import { importStates, indexMetadata } from "../import/domain";
import { LifecycleForm } from "./lifecycle-form";
import type { LifecycleCommand } from "../lifecycle/domain";
export async function RevisionLifecycle({ returnTo, documentId }: { returnTo?: string; documentId: string }) {
  let principal;
  try { principal = await sessionLifecyclePrincipal(documentId, await headers()); } catch { return <p role="alert">Acceso documental no autorizado o sin configurar.</p>; }
  const master = await prisma.controlledDocument.findUniqueOrThrow({ where: { id: documentId }, include: { revisions: { orderBy: { revisionCode: "desc" }, include: { lifecycle: true, decisions: { orderBy: { sequence: "asc" }, include: { evidence: true } }, documents: { select: metadataSelection } } } } });
  return <div><h2>Verificación y aprobaciones</h2><p>Las firmas se realizan fuera de la aplicación. El contraste humano no autentica automáticamente una firma. Registro y aceptación son decisiones distintas.</p>{master.revisions.map(r => {
    const index = indexMetadata(r.sourceMetadata), reset = [...r.decisions].reverse().find(d => d.operation === "RECTIFY")?.sequence || 0;
    const current = r.decisions.filter(d => d.sequence > reset), verification = [...current].reverse().find(d => d.operation === "VERIFY");
    const approvedRoles = new Set<LifecycleCommand["function"]>();
    for (const d of current.filter(d => d.sequence > (verification?.sequence || 0) && d.operation === "CONTRAST_EXTERNAL")) {
      const role = (current.find(v => v.id === (d.details as unknown as LifecycleCommand).registrationId)?.details as unknown as LifecycleCommand)?.function;
      approvedRoles.delete(role); if (d.result === "ACCEPTED") approvedRoles.add(role);
    }
    return <article className="form-section pnt-lifecycle-card" key={r.id} data-lifecycle-revision={r.id}><h3>Revisión {r.revisionCode} — {revisionLabels[r.status]}</h3><p>{r.baseCodeSnapshot} — {r.titleSnapshot} · {r.departmentCodeSnapshot} — {r.departmentNameSnapshot}</p>
      {(r.lifecycle?.legacyOrigin || !r.lifecycle && r.consolidatedAt) && <p>Registro histórico P1A, sin acreditación P2B. No se presume aprobación por su estado previo.</p>}
      <p>Fechas originales conservadas: vigencia {displayDate(r.effectiveFrom)} · revisión {displayDate(r.reviewDueAt)} · obsolescencia {displayDate(r.obsoletedAt)}</p>
      {index && <p>Estado declarado por el índice: {importStates[index.declaredState]} (no acredita vigencia). Hoja {index.sheet} · lote {index.batchId}</p>}
      <details><summary>Fuente y procedencia original (solo lectura)</summary><p>{r.sourceReference}</p><pre>{JSON.stringify(r.sourceMetadata, null, 2)}</pre></details>
      <p>Resultado de verificación: {verification?.result || "Pendiente"}. {verification?.result !== "FAVORABLE" && "Falta contraste documental favorable."}</p>
      <p>Funciones externas contrastadas: {Array.from(approvedRoles).filter(Boolean).join(", ") || "Ninguna"}. Requeridas: preparación, revisión y aprobación conforme a GC-00/001/03; no tres aprobadores.</p>
      <p className="section-help">Faltantes: {verification?.result !== "FAVORABLE" ? "verificación favorable; " : ""}{["PREPARATION", "REVIEW", "APPROVAL"].filter(role => !approvedRoles.has(role as LifecycleCommand["function"])).join(", ") || "ninguna función"}. La vigencia exige además documento final identificado, fechas coherentes, evidencia vigente y confirmación de revisión anterior.</p>
      <p>Fechas operativas: aprobación {displayDate(r.lifecycle?.approvalAt)} · vigencia {displayDate(r.lifecycle?.effectiveFrom)} · revisión prevista {displayDate(r.lifecycle?.reviewDueAt)} · obsolescencia {displayDate(r.lifecycle?.obsoletedAt)}</p>
      <p>Revisión anterior en la activación P2B: {(() => { const activation = [...r.decisions].reverse().find(d => d.operation === "ACTIVATE"); const previous = (activation?.details as unknown as LifecycleCommand | undefined)?.previousRevisionId; return previous ? `${master.revisions.find(v => v.id === previous)?.revisionCode || "—"} (${previous})` : "Sin activación registrada o sin revisión anterior"; })()}</p>
      {r.documents.map(o => <p key={o.id}>Objeto {o.originalName} — {o.kind} · UUID {o.id} · SHA-256 {o.sha256 || "No comprobado: referencia externa"} {o.replacement && "(sustituido; no utilizable para decisiones nuevas)"}</p>)}
      {r.decisions.map(d => <details key={d.id}><summary>#{d.sequence} {d.operation} — {d.result || "Decisión"} — {d.actor} — {displayDate(d.decidedAt)}</summary><p>{d.oldState} → {d.newState}. {d.reason}</p><p>UUID {d.id} · rectifica {d.rectifiesId || "—"} · {d.identitySource}</p><pre>{JSON.stringify(d.details, null, 2)}</pre><pre>{JSON.stringify(d.evidence.map(e => e.snapshot), null, 2)}</pre><details><summary>Snapshots antes/después</summary><pre>{JSON.stringify({ before: d.before, after: d.after }, null, 2)}</pre></details></details>)}
      {master.administrativeStatus !== "ANNULLED" && <LifecycleForm returnTo={returnTo} documentId={documentId} revisionId={r.id} state={r.status} version={r.lifecycle?.version || 0} capabilities={principal.capabilities} previousId={master.revisions.find(v => v.status === "IN_FORCE")?.id || null} objects={r.documents.filter(o => !o.replacement).map(o => ({ id: o.id, originalName: o.originalName, kind: o.kind, externalReference: o.externalReference }))} decisions={r.decisions.map(d => ({ id: d.id, operation: d.operation, label: `#${d.sequence} ${d.operation} ${(d.details as unknown as LifecycleCommand).function || ""} ${(d.details as unknown as LifecycleCommand).externalPerson || ""}`, evidenceIds: (d.details as unknown as LifecycleCommand).evidenceIds }))}/>}
    </article>;
  })}</div>;
}
