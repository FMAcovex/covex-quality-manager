import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { indexMetadata, importStates } from "@/modules/controlled-documents/import/domain";
import { RevisionDocuments } from "@/modules/controlled-documents/components/revision-documents";
import { RevisionLifecycle } from "@/modules/controlled-documents/components/revision-lifecycle";
import { ManualRevisionStatus } from "@/modules/controlled-documents/components/manual-revision-status";
import { sessionLifecyclePrincipal, sessionDocumentPrincipal } from "@/modules/controlled-documents/documents/session-access";
import { DocumentStateBadge } from "@/modules/controlled-documents/components/document-state-badge";
import { canEditRevision } from "@/modules/controlled-documents/revision-editability";
import { revisionProvenance } from "@/modules/controlled-documents/presentation";
import { listingReturnTo, withReturnTo } from "@/modules/controlled-documents/navigation";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { documentHistoryActions } from "@/modules/controlled-documents/documents/history";
import { prisma } from "@/lib/db";
import { administrativeLabels, revisionLabels, verificationLabels, displayDate } from "@/modules/controlled-documents/domain";
export const dynamic = "force-dynamic";
const fields: Record<string, string> = { baseCode: "Código base", baseCodeSnapshot: "Código congelado", title: "Título", titleSnapshot: "Título congelado", departmentCodeSnapshot: "Código de departamento", departmentNameSnapshot: "Departamento", observations: "Observaciones", administrativeStatus: "Estado del maestro", revisionCode: "Revisión", revisionReason: "Motivo de revisión", status: "Estado documental", effectiveFrom: "Vigencia", reviewDueAt: "Revisión prevista", obsoletedAt: "Obsolescencia", sourceReference: "Referencia documental", verificationStatus: "Verificación", verifiedByText: "Responsable de verificación", registeredByText: "Responsable del registro" };
function historyValue(value: unknown) {
    if (value == null)
        return "—";
    const s = String(value);
    return administrativeLabels[s as keyof typeof administrativeLabels] || revisionLabels[s as keyof typeof revisionLabels] || verificationLabels[s as keyof typeof verificationLabels] || s;
}
async function DetailPageAuthenticatedContent({ params, searchParams }: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        tab?: string;
        returnTo?: string;
    }>;
}) {
    const { id } = await params;
    const { tab: requestedTab, returnTo } = await searchParams;
    const backUrl = listingReturnTo(returnTo);
    const returnQuery = backUrl === "/controlled-documents" ? "" : "&returnTo=" + encodeURIComponent(backUrl);
    const tab = requestedTab && ["information", "revisions", "documents", "verification", "history"].includes(requestedTab) ? requestedTab : "information";
    let canManageState = false;
    try { const principal = await sessionLifecyclePrincipal(id, await headers()); canManageState = principal.capabilities.includes("manage-state"); } catch { /* Read-only by default. */ }
    let canReadDocumentHistory = false;
    if (tab === "history") {
        try { await sessionDocumentPrincipal(id, await headers()); canReadDocumentHistory = true; }
        catch { /* Keep ordinary P1A/P1B history available; documentary history fails closed. */ }
    }
    const m = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "desc" }, include: { lifecycle: { select: { version: true, effectiveFrom: true, reviewDueAt: true, obsoletedAt: true, legacyOrigin: true, approvalAt: true } }, decisions: true } }, changes: { where: canReadDocumentHistory ? {} : { action: { notIn: Object.values(documentHistoryActions) } }, orderBy: [{ changedAt: "desc" }, { id: "desc" }] } } });
    if (!m)
        notFound();
    return <section className="workspace pnt-workspace"><header className="record-header pnt-record-header"><div className="pnt-record-identity"><p className="eyebrow">Gestión documental · PNT</p><h1>{m.baseCode || "Borrador PNT"}</h1><p className="pnt-record-title">{m.title || "Sin título"}</p><div className="pnt-record-status"><span className="badge neutral">{administrativeLabels[m.administrativeStatus]}</span><span className="muted-note">{m.departmentCodeSnapshot || "—"} — {m.departmentNameSnapshot || "—"}</span></div></div><Link className="button" href={backUrl}>Volver al listado</Link></header>
 {indexMetadata(m.sourceMetadata) && <p className="section-help">Importado del índice: {m.revisions.every(r => r.verificationStatus !== "VERIFIED") ? "pendiente de verificación documental." : "contraste documental registrado por revisión."} Estado declarado (no acredita vigencia): {importStates[indexMetadata(m.sourceMetadata)!.declaredState]} · <Link href={`/controlled-documents/import-index/${indexMetadata(m.sourceMetadata)!.batchId}`}>Consultar lote de origen</Link></p>}
 <nav className="record-tabs pnt-record-tabs" aria-label="Pestañas del PNT">{[["information", "Información"], ["revisions", "Revisiones"], ["documents", "Documentos"], ["history", "Historial"]].map(([key, label]) => <Link key={key} className={tab === key ? "active" : ""} href={`/controlled-documents/${id}?tab=${key}${returnQuery}`} aria-current={tab === key ? "page" : undefined}>{label} </Link>)}</nav>
 {tab === "information" && canManageState && m.revisions.length > 0 && m.administrativeStatus !== "ANNULLED" && <section className="card pnt-manual-panel"><div className="page-heading"><div><h2>Estado de las revisiones</h2><p className="muted-note">Estado registrado manualmente según documentación aprobada fuera de la aplicación. No equivale a una firma electrónica.</p></div></div>{m.revisions.map(r => <div key={r.id} className="pnt-manual-revision"><div className="pnt-manual-heading"><strong>{r.baseCodeSnapshot || m.baseCode}/{r.revisionCode}</strong><DocumentStateBadge status={r.status}/></div><ManualRevisionStatus returnTo={backUrl} documentId={id} revisionId={r.id} revisionCode={r.revisionCode} status={r.status} version={r.lifecycle?.version || 0} updatedAt={r.updatedAt.toISOString()} previousRevisionId={m.revisions.find(v => v.status === "IN_FORCE" && v.id !== r.id)?.id || null} effectiveFrom={r.lifecycle ? (r.lifecycle.effectiveFrom?.toISOString().slice(0,10) || null) : (r.effectiveFrom?.toISOString().slice(0,10) || null)} reviewDueAt={r.lifecycle ? (r.lifecycle.reviewDueAt?.toISOString().slice(0,10) || null) : (r.reviewDueAt?.toISOString().slice(0,10) || null)}/></div>)}</section>}
 {tab === "information" && <div className="card pnt-info-panel"><div className="page-heading"><h2>Información</h2>{m.administrativeStatus !== "ANNULLED" && <PermissionGate permission="EDIT" form><Link className="button" href={withReturnTo(`/controlled-documents/${id}/edit`, backUrl)}>Editar maestro</Link></PermissionGate>}</div><dl className="info-grid"><div className="info-item"><dt>Tipo documental</dt><dd>PNT</dd></div><div className="info-item"><dt>Departamento congelado</dt><dd>{m.departmentCodeSnapshot || "—"} — {m.departmentNameSnapshot || "—"}</dd></div><div className="info-item"><dt>Alta</dt><dd>{displayDate(m.createdAt)} — {m.createdByText}</dd></div><div className="info-item"><dt>Modificación</dt><dd>{displayDate(m.updatedAt)}</dd></div><div className="info-item full"><dt>Observaciones</dt><dd style={{ whiteSpace: "pre-wrap" }}>{m.observations || "—"}</dd></div></dl></div>}
 {tab === "revisions" && <div className="form-stack pnt-revisions-panel"><div className="page-heading"><h2>Revisiones</h2>{m.administrativeStatus === "ACTIVE" && <PermissionGate permission="EDIT"><Link className="button primary" href={withReturnTo(`/controlled-documents/${id}/revisions/new`, backUrl)}>Añadir revisión</Link></PermissionGate>}</div>{!m.revisions.length && <p>No hay revisiones documentadas.</p>}{m.revisions.map(r => <article className="form-section pnt-revision-card" key={r.id}><header className="pnt-revision-header"><h3>{r.baseCodeSnapshot || "Sin código"}/{r.revisionCode}</h3><DocumentStateBadge status={r.status}/></header><p className="pnt-revision-title">{r.titleSnapshot}</p><p className="muted-note pnt-revision-note">{revisionProvenance(r)}</p>{indexMetadata(r.sourceMetadata) && <p className="section-help">{importStates[indexMetadata(r.sourceMetadata)!.declaredState]} · {r.verificationStatus !== "VERIFIED" ? "pendiente de verificación documental" : "contraste registrado"} · <Link href={`/controlled-documents/import-index/${indexMetadata(r.sourceMetadata)!.batchId}`}>Lote de origen</Link></p>}<dl className="info-grid pnt-revision-info"><div className="info-item"><dt>Departamento</dt><dd>{r.departmentCodeSnapshot} — {r.departmentNameSnapshot}</dd></div><div className="info-item"><dt>Revisión anterior</dt><dd>{m.revisions.find(p => p.id === r.previousRevisionId)?.revisionCode || "No documentada"}</dd></div><div className="info-item full"><dt>Motivo</dt><dd className="prose-value">{r.revisionReason || "Sin determinar"}</dd></div><div className="info-item"><dt>Vigencia</dt><dd>{displayDate(r.lifecycle ? r.lifecycle.effectiveFrom : r.effectiveFrom)}</dd></div><div className="info-item"><dt>Revisión prevista</dt><dd>{displayDate(r.lifecycle ? r.lifecycle.reviewDueAt : r.reviewDueAt)}</dd></div><div className="info-item"><dt>Obsolescencia</dt><dd>{displayDate(r.lifecycle ? r.lifecycle.obsoletedAt : r.obsoletedAt)}</dd></div><div className="info-item"><dt>Registrado por</dt><dd>{r.registeredByText} el {displayDate(r.registeredAt)}</dd></div></dl>{(r.lifecycle?.legacyOrigin || !r.lifecycle && r.consolidatedAt) && <p className="muted-note pnt-revision-note">Registro histórico P1A, sin acreditación P2B.</p>}{canEditRevision(r) && m.administrativeStatus === "ACTIVE" ? <PermissionGate permission="EDIT" form><Link className="button" href={withReturnTo(`/controlled-documents/${id}/revisions/${r.id}/edit`, backUrl)}>Editar revisión en elaboración</Link></PermissionGate> : <p className="muted-note pnt-revision-note">Contenido de solo lectura en esta fase documental.</p>}</article>)}</div>}
 <div className="pnt-tab-content pnt-detail-panel">
 {tab === "documents" && <RevisionDocuments returnTo={backUrl} documentId={id} revisions={m.revisions} annulled={m.administrativeStatus === "ANNULLED"} />}
 {tab === "verification" && <RevisionLifecycle returnTo={backUrl} documentId={id} />}
 {tab === "history" && <div className="pnt-history-panel"><h2>Historial operativo</h2>{m.changes.map(c => { const old = (c.oldValue || {}) as Record<string, unknown>; const next = (c.newValue || {}) as Record<string, unknown>; return <article className="form-section pnt-history-item" key={c.id}><h3>{c.action}</h3><p>{displayDate(c.changedAt)} — {c.changedByText}</p><p>{c.reason}</p><ul>{Object.entries(fields).filter(([key]) => JSON.stringify(old[key]) !== JSON.stringify(next[key]) && (key in old || key in next)).map(([key, label]) => <li key={key}>{label}: {historyValue(old[key])} → {historyValue(next[key])}</li>)}</ul></article>; })}</div>}
 </div></section>;
}

export default async function DetailPage(...args: Parameters<typeof DetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/[id]/page.tsx", () => DetailPageAuthenticatedContent(...args), args);
}
