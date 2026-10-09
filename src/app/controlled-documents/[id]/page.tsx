import { indexMetadata, importStates } from "@/modules/controlled-documents/import/domain";
import { RevisionDocuments } from "@/modules/controlled-documents/components/revision-documents";
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
    const tab = requestedTab && ["information", "revisions", "documents", "history"].includes(requestedTab) ? requestedTab : "information";
    let canReadDocumentHistory = false;
    if (tab === "history") {
        try { documentPrincipal(await headers()); canReadDocumentHistory = true; }
        catch { /* Keep ordinary P1A/P1B history available; documentary history fails closed. */ }
    }
    const m = await prisma.controlledDocument.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "desc" } }, changes: { where: canReadDocumentHistory ? {} : { action: { notIn: Object.values(documentHistoryActions) } }, orderBy: [{ changedAt: "desc" }, { id: "desc" }] } } });
    if (!m)
        notFound();
    return <section className="workspace"><Link href="/controlled-documents">Volver al listado</Link><h1>{m.baseCode || "Borrador PNT"} — {m.title || "Sin título"}</h1><p>{administrativeLabels[m.administrativeStatus]}</p>
 {indexMetadata(m.sourceMetadata) && <p>Importado del índice: pendiente de verificación documental. {importStates[indexMetadata(m.sourceMetadata)!.declaredState]} · <Link href={`/controlled-documents/import-index/${indexMetadata(m.sourceMetadata)!.batchId}`}>Consultar lote de origen</Link></p>}
 <nav>{[["information", "Información"], ["revisions", "Revisiones"], ["documents", "Documentos"], ["history", "Historial"]].map(([key, label]) => <Link key={key} href={`/controlled-documents/${id}?tab=${key}`} aria-current={tab === key ? "page" : undefined}>{label} </Link>)}</nav>
 {tab === "information" && <div><h2>Información</h2><dl><dt>Tipo documental</dt><dd>PNT</dd><dt>Departamento congelado</dt><dd>{m.departmentCodeSnapshot || "—"} — {m.departmentNameSnapshot || "—"}</dd><dt>Alta</dt><dd>{displayDate(m.createdAt)} — {m.createdByText}</dd><dt>Modificación</dt><dd>{displayDate(m.updatedAt)}</dd><dt>Observaciones</dt><dd style={{ whiteSpace: "pre-wrap" }}>{m.observations || "—"}</dd></dl>{m.administrativeStatus !== "ANNULLED" && <Link href={`/controlled-documents/${id}/edit`}>Editar maestro</Link>}</div>}
 {tab === "revisions" && <div><h2>Revisiones</h2>{m.administrativeStatus === "ACTIVE" && <Link href={`/controlled-documents/${id}/revisions/new`}>Añadir revisión</Link>}{!m.revisions.length && <p>No hay revisiones documentadas.</p>}{m.revisions.map(r => <article className="form-section" key={r.id}><h3>{r.baseCodeSnapshot || "Sin código"}/{r.revisionCode} — {revisionLabels[r.status]}</h3><p>{r.titleSnapshot}</p>{indexMetadata(r.sourceMetadata) && <p>{importStates[indexMetadata(r.sourceMetadata)!.declaredState]} · pendiente de verificación documental · <Link href={`/controlled-documents/import-index/${indexMetadata(r.sourceMetadata)!.batchId}`}>Lote de origen</Link></p>}<p>Departamento: {r.departmentCodeSnapshot} — {r.departmentNameSnapshot}</p><p>Motivo: {r.revisionReason || "Sin determinar"}</p><p>Vigencia: {displayDate(r.effectiveFrom)} · Revisión prevista: {displayDate(r.reviewDueAt)} · Obsolescencia: {displayDate(r.obsoletedAt)}</p><p>Revisión anterior: {m.revisions.find(p => p.id === r.previousRevisionId)?.revisionCode || "No documentada"}</p><p>Registrado por {r.registeredByText} el {displayDate(r.registeredAt)}</p>{r.status === "DRAFT" && !r.consolidatedAt && m.administrativeStatus === "ACTIVE" ? <Link href={`/controlled-documents/${id}/revisions/${r.id}/edit`}>Editar revisión en elaboración</Link> : <p>{r.consolidatedAt ? "Revisión consolidada: contenido de solo lectura." : "Revisión importada pendiente de contraste documental; el índice no acredita aprobación."}</p>}</article>)}</div>}
 {tab === "documents" && <RevisionDocuments documentId={id} revisions={m.revisions} annulled={m.administrativeStatus === "ANNULLED"} />}
 {tab === "history" && <div><h2>Historial operativo</h2>{m.changes.map(c => { const old = (c.oldValue || {}) as Record<string, unknown>; const next = (c.newValue || {}) as Record<string, unknown>; return <article className="form-section" key={c.id}><h3>{c.action}</h3><p>{displayDate(c.changedAt)} — {c.changedByText}</p><p>{c.reason}</p><ul>{Object.entries(fields).filter(([key]) => JSON.stringify(old[key]) !== JSON.stringify(next[key]) && (key in old || key in next)).map(([key, label]) => <li key={key}>{label}: {historyValue(old[key])} → {historyValue(next[key])}</li>)}</ul></article>; })}</div>}
 </section>;
}
