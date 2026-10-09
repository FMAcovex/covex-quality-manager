import { indexMetadata, importStates } from "@/modules/controlled-documents/import/domain";
import { RevisionDocuments } from "@/modules/controlled-documents/components/revision-documents";
import { RevisionLifecycle } from "@/modules/controlled-documents/components/revision-lifecycle";
import { ManualRevisionStatus } from "@/modules/controlled-documents/components/manual-revision-status";
import { lifecyclePrincipal } from "@/modules/controlled-documents/lifecycle/access";
import { manualStateLabels } from "@/modules/controlled-documents/manual-state/domain";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { documentPrincipal } from "@/modules/controlled-documents/documents/access";
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
export default async function DetailPage({ params, searchParams }: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        tab?: string;
    }>;
}) {
    const { id } = await params;
    const { tab: requestedTab } = await searchParams;
    const tab = requestedTab && ["information", "revisions", "documents", "verification", "history"].includes(requestedTab) ? requestedTab : "information";
    let canManageState = false;
    try { const principal = lifecyclePrincipal(await headers()); canManageState = principal.capabilities.includes("manage-state"); } catch { /* Read-only by default. */ }
    let canReadDocumentHistory = false;
    if (tab === "history") {
        try { documentPrincipal(await headers()); canReadDocumentHistory = true; }
        catch { /* Keep ordinary P1A/P1B history available; documentary history fails closed. */ }
    }
    const m = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "desc" }, include: { lifecycle: { select: { version: true, effectiveFrom: true, reviewDueAt: true, obsoletedAt: true, legacyOrigin: true } } } }, changes: { where: canReadDocumentHistory ? {} : { action: { notIn: Object.values(documentHistoryActions) } }, orderBy: [{ changedAt: "desc" }, { id: "desc" }] } } });
    if (!m)
        notFound();
    return <section className="workspace pnt-workspace"><header className="record-header pnt-record-header"><div className="pnt-record-identity"><p className="eyebrow">Gestión documental · PNT</p><h1>{m.baseCode || "Borrador PNT"}</h1><p className="pnt-record-title">{m.title || "Sin título"}</p><div className="pnt-record-status"><span className="badge neutral">{administrativeLabels[m.administrativeStatus]}</span><span className="muted-note">{m.departmentCodeSnapshot || "—"} — {m.departmentNameSnapshot || "—"}</span></div></div><Link className="button" href="/controlled-documents">Volver al listado</Link></header>
 {indexMetadata(m.sourceMetadata) && <p className="section-help">Importado del índice: {m.revisions.every(r => r.verificationStatus !== "VERIFIED") ? "pendiente de verificación documental." : "contraste documental registrado por revisión."} Estado declarado (no acredita vigencia): {importStates[indexMetadata(m.sourceMetadata)!.declaredState]} · <Link href={`/controlled-documents/import-index/${indexMetadata(m.sourceMetadata)!.batchId}`}>Consultar lote de origen</Link></p>}
 <nav className="record-tabs pnt-record-tabs" aria-label="Pestañas del PNT">{[["information", "Información"], ["revisions", "Revisiones"], ["documents", "Documentos"], ["history", "Historial"]].map(([key, label]) => <Link key={key} className={tab === key ? "active" : ""} href={`/controlled-documents/${id}?tab=${key}`} aria-current={tab === key ? "page" : undefined}>{label} </Link>)}</nav>
 {tab === "information" && canManageState && m.revisions.length > 0 && m.administrativeStatus !== "ANNULLED" && <section className="card pnt-manual-panel"><div className="page-heading"><div><h2>Estado de las revisiones</h2><p className="muted-note">Estado registrado manualmente según documentación aprobada fuera de la aplicación. No equivale a una firma electrónica.</p></div></div>{m.revisions.map(r => <div key={r.id} className="pnt-manual-revision"><div className="pnt-manual-heading"><strong>{r.baseCodeSnapshot || m.baseCode}/{r.revisionCode}</strong><span className="badge neutral">{manualStateLabels[r.status as keyof typeof manualStateLabels] || revisionLabels[r.status]}</span></div><ManualRevisionStatus documentId={id} revisionId={r.id} revisionCode={r.revisionCode} status={r.status} version={r.lifecycle?.version || 0} updatedAt={r.updatedAt.toISOString()} previousRevisionId={m.revisions.find(v => v.status === "IN_FORCE" && v.id !== r.id)?.id || null} effectiveFrom={r.lifecycle ? (r.lifecycle.effectiveFrom?.toISOString().slice(0,10) || null) : (r.effectiveFrom?.toISOString().slice(0,10) || null)} reviewDueAt={r.lifecycle ? (r.lifecycle.reviewDueAt?.toISOString().slice(0,10) || null) : (r.reviewDueAt?.toISOString().slice(0,10) || null)}/></div>)}</section>}
 {tab === "information" && <div className="card"><div className="page-heading"><h2>Información</h2>{m.administrativeStatus !== "ANNULLED" && <Link className="button" href={`/controlled-documents/${id}/edit`}>Editar maestro</Link>}</div><dl className="info-grid"><div className="info-item"><dt>Tipo documental</dt><dd>PNT</dd></div><div className="info-item"><dt>Departamento congelado</dt><dd>{m.departmentCodeSnapshot || "—"} — {m.departmentNameSnapshot || "—"}</dd></div><div className="info-item"><dt>Alta</dt><dd>{displayDate(m.createdAt)} — {m.createdByText}</dd></div><div className="info-item"><dt>Modificación</dt><dd>{displayDate(m.updatedAt)}</dd></div><div className="info-item full"><dt>Observaciones</dt><dd style={{ whiteSpace: "pre-wrap" }}>{m.observations || "—"}</dd></div></dl></div>}
 {tab === "revisions" && <div className="form-stack"><div className="page-heading"><h2>Revisiones</h2>{m.administrativeStatus === "ACTIVE" && <Link className="button primary" href={`/controlled-documents/${id}/revisions/new`}>Añadir revisión</Link>}</div>{!m.revisions.length && <p>No hay revisiones documentadas.</p>}{m.revisions.map(r => <article className="form-section" key={r.id}><header className="pnt-revision-header"><h3>{r.baseCodeSnapshot || "Sin código"}/{r.revisionCode}</h3><span className="badge neutral">{revisionLabels[r.status]}</span></header><p className="pnt-revision-title">{r.titleSnapshot}</p>{indexMetadata(r.sourceMetadata) && <p className="section-help">{importStates[indexMetadata(r.sourceMetadata)!.declaredState]} · {r.verificationStatus !== "VERIFIED" ? "pendiente de verificación documental" : "contraste registrado"} · <Link href={`/controlled-documents/import-index/${indexMetadata(r.sourceMetadata)!.batchId}`}>Lote de origen</Link></p>}<dl className="info-grid pnt-revision-info"><div className="info-item"><dt>Departamento</dt><dd>{r.departmentCodeSnapshot} — {r.departmentNameSnapshot}</dd></div><div className="info-item"><dt>Revisión anterior</dt><dd>{m.revisions.find(p => p.id === r.previousRevisionId)?.revisionCode || "No documentada"}</dd></div><div className="info-item full"><dt>Motivo</dt><dd className="prose-value">{r.revisionReason || "Sin determinar"}</dd></div><div className="info-item"><dt>Vigencia</dt><dd>{displayDate(r.lifecycle ? r.lifecycle.effectiveFrom : r.effectiveFrom)}</dd></div><div className="info-item"><dt>Revisión prevista</dt><dd>{displayDate(r.lifecycle ? r.lifecycle.reviewDueAt : r.reviewDueAt)}</dd></div><div className="info-item"><dt>Obsolescencia</dt><dd>{displayDate(r.lifecycle ? r.lifecycle.obsoletedAt : r.obsoletedAt)}</dd></div><div className="info-item"><dt>Registrado por</dt><dd>{r.registeredByText} el {displayDate(r.registeredAt)}</dd></div></dl>{(r.lifecycle?.legacyOrigin || !r.lifecycle && r.consolidatedAt) && <p className="muted-note pnt-revision-note">Registro histórico P1A, sin acreditación P2B.</p>}{r.status === "DRAFT" && !r.consolidatedAt && !r.lifecycle && m.administrativeStatus === "ACTIVE" ? <Link className="button" href={`/controlled-documents/${id}/revisions/${r.id}/edit`}>Editar revisión en elaboración</Link> : <p className="muted-note pnt-revision-note">{r.consolidatedAt ? "Revisión consolidada: contenido de solo lectura." : "Revisión importada pendiente de contraste documental; el índice no acredita aprobación."}</p>}</article>)}</div>}
 <div className="pnt-tab-content">
 {tab === "documents" && <RevisionDocuments documentId={id} revisions={m.revisions} annulled={m.administrativeStatus === "ANNULLED"} />}
 {tab === "verification" && <RevisionLifecycle documentId={id} />}
 {tab === "history" && <div><h2>Historial operativo</h2>{m.changes.map(c => { const old = (c.oldValue || {}) as Record<string, unknown>; const next = (c.newValue || {}) as Record<string, unknown>; return <article className="form-section" key={c.id}><h3>{c.action}</h3><p>{displayDate(c.changedAt)} — {c.changedByText}</p><p>{c.reason}</p><ul>{Object.entries(fields).filter(([key]) => JSON.stringify(old[key]) !== JSON.stringify(next[key]) && (key in old || key in next)).map(([key, label]) => <li key={key}>{label}: {historyValue(old[key])} → {historyValue(next[key])}</li>)}</ul></article>; })}</div>}
 </div></section>;
}
