import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditTrailPanel } from "@/components/audit-trail-panel";
import { CsrfField } from "@/components/csrf";
import { OperationalRelationForm } from "@/components/operational-relation-form";
import { ActorField, PermissionGate } from "@/components/permissions";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { RecordTimeline } from "@/components/record-timeline";
import { SignedVersionDocumentForm } from "@/components/signed-version-document-form";
import { ReviewDrawer, ReviewMarker, ReviewModeToggle, ReviewStatusSummary, ReviewThreadList, ReviewWorkspaceProvider } from "@/components/review";
import { authorizedPage } from "@/lib/auth/page-guard";
import { currentActor } from "@/lib/auth/presentation";
import { qmsListingReturnTo, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { oosReviewTargets } from "@/lib/qms/review/targets/oos";
import type { ReviewTargetInstance } from "@/lib/qms/review/targets/types";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";
import { activeReviewCount, reviewModeHref, reviewTabHref } from "@/lib/qms/review/ui-model";
import { addOosRelationAction, unlinkOosRelationAction } from "@/modules/oos/actions";
import {
  formatOosDate,
  oosAreaLabels,
  oosInvestigationResultLabels,
  oosMaterialKindLabels,
  oosPhase,
  oosPhaseIDispositionLabels,
  oosPhaseIEvaluationGroups,
  oosStatusLabels,
  oosVerdictLabels,
  readOosEvaluation,
} from "@/modules/oos/domain";
import { getOosDetail } from "@/modules/oos/queries";
import { uploadOosSignedPdfAction } from "@/modules/oos/signed-document-actions";
import { oosSignedAnnexes, type OosSignedAnnex } from "@/modules/oos/signed-documents";

export const dynamic = "force-dynamic";

const txt = (value: string | null | undefined) => value || "—";

function Item({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`info-item${full ? " full" : ""}`}><dt>{label}</dt><dd>{children}</dd></div>;
}

function ReviewCard({ target, title, children }: { target: ReviewTargetInstance; title: string; children: React.ReactNode }) {
  return <div id={target.anchorId} className="card review-target"><div className="review-target-heading"><h2>{title}</h2><ReviewMarker target={target} /></div>{children}</div>;
}

function ReviewItem({ target, label, children }: { target: ReviewTargetInstance; label: string; children: React.ReactNode }) {
  return <div id={target.anchorId} className="info-item full review-target"><dt className="review-target-heading">{label}<ReviewMarker target={target} /></dt><dd>{children}</dd></div>;
}

function Verdict({ verdict, quantity, destroy, returned, other }: { verdict: keyof typeof oosVerdictLabels | null; quantity: string | null; destroy: string | null; returned: string | null; other: string | null }) {
  return <>
    <Item label="Dictamen">{verdict ? oosVerdictLabels[verdict] : "Pendiente"}</Item>
    <Item label="Cantidad">{txt(quantity)}</Item>
    <Item label="Destruir · cantidad">{txt(destroy)}</Item>
    <Item label="Devolver · cantidad">{txt(returned)}</Item>
    {verdict === "OTHER" ? <Item label="Otros · indicar" full>{txt(other)}</Item> : null}
  </>;
}

async function OosDetailPageAuthenticatedContent({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; returnTo?: string; auditPage?: string; review?: string; thread?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, returnTo, auditPage, review, thread } = await searchParams;
  const record = await getOosDetail(id);
  if (!record) notFound();

  const phase = oosPhase(record.phaseIDisposition);
  const tabs = [
    ["summary", "Resumen"],
    ["phase-i", "Fase I"],
    ...(phase === "II" ? [["phase-ii", "Fase II"]] : []),
    ["relations", "Relaciones"],
    ["documents", "Documentos"],
    ["review", "Revisión"],
    ["timeline", "Cronología"],
    ["audit-trail", "Audit Trail"],
    ["history", "Historial"],
  ] as const;
  const tab = tabs.some(([key]) => key === rawTab) ? rawTab! : "summary";
  const basePath = `/oos/${id}`;
  const evaluation = readOosEvaluation(record.phaseIEvaluation);
  const statusBadge = record.status === "DRAFT" ? "neutral" : record.status === "OPEN" ? "open" : "closed";
  const reviewMode = review === "1";
  const reviewThreads = await getReviewThreadsForDisplay(record.qmsRecord.id);
  const reviewActiveCount = activeReviewCount({
    PENDING: reviewThreads.filter((item) => item.status === "PENDING").length,
    ACCEPTED: reviewThreads.filter((item) => item.status === "ACCEPTED").length,
  });
  const verdictValue = (verdict: keyof typeof oosVerdictLabels | null, other: string | null) => (verdict ? oosVerdictLabels[verdict] : "Pendiente") + (verdict === "OTHER" && other ? ` · ${other}` : "");
  const target = {
    initialData: reviewTargetWithValue(oosReviewTargets.initialData, { area: record.area ?? "—", material: txt(record.materialName), lot: txt(record.lotNumber), oosDate: formatOosDate(record.oosDate) }),
    detection: reviewTargetWithValue(oosReviewTargets.detection, txt(record.detectionDescription)),
    result: reviewTargetWithValue(oosReviewTargets.result, { disposition: record.phaseIDisposition ?? "—", result: record.investigationResult ?? "—", closedAt: formatOosDate(record.closedAt) }),
    phaseIEvaluation: reviewTargetWithValue(oosReviewTargets.phaseIEvaluation, evaluation),
    phaseIInvestigation: reviewTargetWithValue(oosReviewTargets.phaseIInvestigation, txt(record.phaseIInvestigation)),
    phaseIConclusion: reviewTargetWithValue(oosReviewTargets.phaseIConclusion, txt(record.phaseIConclusion)),
    phaseIVerdict: reviewTargetWithValue(oosReviewTargets.phaseIVerdict, { disposition: record.phaseIDisposition ?? "—", verdict: verdictValue(record.phaseIVerdict, record.phaseIVerdictOther) }),
    phaseIIProductionReview: reviewTargetWithValue(oosReviewTargets.phaseIIProductionReview, txt(record.phaseIIProductionReview)),
    phaseIIRetesting: reviewTargetWithValue(oosReviewTargets.phaseIIRetesting, txt(record.phaseIIRetesting)),
    phaseIIResampling: reviewTargetWithValue(oosReviewTargets.phaseIIResampling, txt(record.phaseIIResampling)),
    phaseIIConclusion: reviewTargetWithValue(oosReviewTargets.phaseIIConclusion, txt(record.phaseIIConclusion)),
    phaseIIVerdict: reviewTargetWithValue(oosReviewTargets.phaseIIVerdict, verdictValue(record.phaseIIVerdict, record.phaseIIVerdictOther)),
    relations: reviewTargetWithValue(oosReviewTargets.relations, record.qmsRecord.sourceRelations.map(({ targetRecord: related }) => qmsRecordDisplayCode(related, qmsRecordTypeLabel(related.recordType)))),
  };

  return <ReviewWorkspaceProvider qmsRecordId={record.qmsRecord.id} module="OOS" basePath={basePath} currentVersionLabel="" showVersionContext={false} recordVersionAssociation="NONE" defaultActor={currentActor()} reviewMode={reviewMode} targets={Object.values(target)} threads={reviewThreads} initialThreadId={thread}>
  <section className={`workspace${reviewMode ? " review-mode-active" : ""}`}>
    <div className="record-header">
      <div>
        <p className="eyebrow"><Link href={qmsListingReturnTo("/oos", returnTo)}>← OOS</Link></p>
        <div className="record-title-line">
          <h1>{qmsRecordDisplayCode(record.qmsRecord)}</h1>
          <span className={`badge ${statusBadge}`}>{oosStatusLabels[record.status]}</span>
          {record.status !== "DRAFT" ? <span className="badge neutral">Fase {phase}</span> : null}
          {record.investigationResult ? <span className="badge neutral">{oosInvestigationResultLabels[record.investigationResult]}</span> : null}
        </div>
        <p className="muted-note">{record.area ? oosAreaLabels[record.area] : "Área pendiente"} · {txt(record.materialName)} · lote {txt(record.lotNumber)}</p>
      </div>
      <div className="record-actions">
        <PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath, tab, reviewMode), "/oos", returnTo)} /></PermissionGate>
        {record.qmsRecord.isActive && record.status !== "DRAFT" ? <PermissionGate permission="DOWNLOAD"><a className="button" href={`/api/oos/${id}/annex-iii`}>Anexo III</a></PermissionGate> : null}
        {record.qmsRecord.isActive && record.status !== "DRAFT" && record.phaseIDisposition === "FULL_SCALE" ? <PermissionGate permission="DOWNLOAD"><a className="button" href={`/api/oos/${id}/annex-iv`}>Anexo IV</a></PermissionGate> : null}
        {record.qmsRecord.isActive ? <PermissionGate permission="EDIT" form><Link className="button primary" href={qmsWithReturnTo(`/oos/${id}/edit?tab=${tab}`, "/oos", returnTo)}>Editar</Link></PermissionGate> : null}
      </div>
    </div>

    {record.status === "DRAFT" ? <div className="analytics-note"><strong>Borrador:</strong> este OOS todavía no tiene código. Completa los datos iniciales y cambia el estado a Abierto para asignarlo.</div> : null}

    <QmsAdministrativeStatus
      qmsRecordId={record.qmsRecord.id}
      isActive={record.qmsRecord.isActive}
      code={qmsRecordDisplayCode(record.qmsRecord)}
      annulledAt={record.qmsRecord.annulledAt?.toISOString() ?? null}
      annulledByText={record.qmsRecord.annulledByText}
      annulledReason={record.qmsRecord.annulledReason}
      defaultActor={currentActor()}
    />

    <nav className="record-tabs">
      {tabs.map(([key, label]) => <Link key={key} className={tab === key ? "active" : ""} href={qmsWithReturnTo(reviewTabHref(basePath, key, reviewMode), "/oos", returnTo)}>{key === "review" ? `${label} (${reviewActiveCount})` : label}</Link>)}
    </nav>

    {tab === "summary" ? <>
      <ReviewCard target={target.initialData} title="Datos iniciales">
        <dl className="info-grid">
          <Item label="Área">{record.area ? oosAreaLabels[record.area] : "—"}</Item>
          <Item label="Departamento">{record.departmentCodeSnapshot ?? record.department?.code ?? "—"}</Item>
          <Item label="Fecha de emisión">{formatOosDate(record.issueDate)}</Item>
          <Item label="Cumplimentado por">{txt(record.createdByText)}</Item>
          <Item label="Material afectado">{record.materialKind ? oosMaterialKindLabels[record.materialKind] : "—"}</Item>
          <Item label="Producto / material">{txt(record.materialName)}</Item>
          <Item label="N.º lote">{txt(record.lotNumber)}</Item>
          <Item label="Tamaño lote">{txt(record.batchSize)}</Item>
          <Item label="Cantidad afectada">{txt(record.affectedQuantity)}</Item>
          {record.materialKind === "RAW_OR_PACKAGING_MATERIAL" ? <>
            <Item label="Proveedor">{txt(record.supplier)}</Item>
            <Item label="Lote proveedor">{txt(record.supplierLot)}</Item>
          </> : null}
          <Item label="Proceso">{txt(record.process)}</Item>
          <Item label="Fecha / hora del OOS">{formatOosDate(record.oosDate)}{record.oosTime ? ` · ${record.oosTime}` : ""}</Item>
          <Item label="Detectado por">{txt(record.detectedBy)}</Item>
          <Item label="Turno">{txt(record.shift)}</Item>
        </dl>
      </ReviewCard>
      <ReviewCard target={target.detection} title="Detección del fuera de especificaciones">
        <p className="prose-value">{txt(record.detectionDescription)}</p>
      </ReviewCard>
      <ReviewCard target={target.result} title="Resultado">
        <dl className="info-grid">
          <Item label="Fase">{record.status === "DRAFT" ? "—" : `Fase ${phase}`}</Item>
          <Item label="Disposición de la Fase I">{record.phaseIDisposition ? oosPhaseIDispositionLabels[record.phaseIDisposition] : "Pendiente"}</Item>
          <Item label="Resultado de la investigación">{record.investigationResult ? oosInvestigationResultLabels[record.investigationResult] : "Pendiente"}</Item>
          <Item label="Fecha de cierre">{formatOosDate(record.closedAt)}</Item>
        </dl>
      </ReviewCard>
      {record.internalObservations ? <div className="card"><h2>Observaciones internas</h2><p className="prose-value">{record.internalObservations}</p></div> : null}
    </> : null}

    {tab === "phase-i" ? <>
      {record.qmsRecord.isActive && record.status === "OPEN" && !record.phaseIDisposition ? <div className="analytics-note oos-phase-ii-note">
        <span><strong>Fase II:</strong> si la investigación en el laboratorio no confirma un error de laboratorio, elige la disposición final «Investigación a gran escala» para abrir la Fase II (Anexo IV).</span>
        <PermissionGate permission="EDIT" form><Link className="button" href={qmsWithReturnTo(`/oos/${id}/edit?tab=phase-i#phase-i-disposition`, "/oos", returnTo)}>Pasar a Fase II</Link></PermissionGate>
      </div> : null}
      <ReviewCard target={target.phaseIEvaluation} title="Evaluación del fuera de especificación">
        <div className="table-scroll"><table className="records-table">
          <thead><tr><th>Parámetro</th><th>Resultado</th></tr></thead>
          <tbody>{oosPhaseIEvaluationGroups.map((group) => [
            <tr key={group.key}><th colSpan={2}>{group.label}</th></tr>,
            ...group.items.map((item) => <tr key={item.key}><td>{item.label}</td><td>{txt(evaluation[item.key])}</td></tr>),
          ])}</tbody>
        </table></div>
      </ReviewCard>
      <div className="card">
        <h2>Investigación en el laboratorio</h2>
        <dl className="info-grid">
          <ReviewItem target={target.phaseIInvestigation} label="Investigación (causa raíz)"><span className="prose-value">{txt(record.phaseIInvestigation)}</span></ReviewItem>
          <ReviewItem target={target.phaseIConclusion} label="Conclusiones"><span className="prose-value">{txt(record.phaseIConclusion)}</span></ReviewItem>
        </dl>
      </div>
      <ReviewCard target={target.phaseIVerdict} title="Disposición final y dictamen">
        <dl className="info-grid">
          <Item label="Disposición final">{record.phaseIDisposition ? oosPhaseIDispositionLabels[record.phaseIDisposition] : "Pendiente"}</Item>
          <Verdict verdict={record.phaseIVerdict} quantity={record.phaseIVerdictQuantity} destroy={record.phaseIDestroyQuantity} returned={record.phaseIReturnQuantity} other={record.phaseIVerdictOther} />
          <Item label="Emitido por · Control de Calidad">{txt(record.phaseIIssuedBy)} · {formatOosDate(record.phaseIIssuedAt)}</Item>
          <Item label="Aprobado por · Garantía de Calidad">{txt(record.phaseIApprovedBy)} · {formatOosDate(record.phaseIApprovedAt)}</Item>
        </dl>
      </ReviewCard>
    </> : null}

    {tab === "phase-ii" ? <><div className="card">
      <h2>Investigación a gran escala</h2>
      <dl className="info-grid">
        <Item label="Fecha de emisión">{formatOosDate(record.phaseIIIssueDate)}</Item>
        <ReviewItem target={target.phaseIIProductionReview} label="Revisión de la producción"><span className="prose-value">{txt(record.phaseIIProductionReview)}</span></ReviewItem>
        <ReviewItem target={target.phaseIIRetesting} label="Repetición de pruebas"><span className="prose-value">{txt(record.phaseIIRetesting)}</span></ReviewItem>
        <ReviewItem target={target.phaseIIResampling} label="Remuestreo"><span className="prose-value">{txt(record.phaseIIResampling)}</span></ReviewItem>
        <ReviewItem target={target.phaseIIConclusion} label="Conclusión de la investigación"><span className="prose-value">{txt(record.phaseIIConclusion)}</span></ReviewItem>
      </dl>
    </div>
    <ReviewCard target={target.phaseIIVerdict} title="Dictamen">
      <dl className="info-grid">
        <Verdict verdict={record.phaseIIVerdict} quantity={record.phaseIIVerdictQuantity} destroy={record.phaseIIDestroyQuantity} returned={record.phaseIIReturnQuantity} other={record.phaseIIVerdictOther} />
        <Item label="Emitido por · Garantía de Calidad">{txt(record.phaseIIIssuedBy)} · {formatOosDate(record.phaseIIIssuedAt)}</Item>
        <Item label="Departamentos afectados" full><span className="prose-value">{txt(record.phaseIIAffectedDepartments)}</span></Item>
      </dl>
    </ReviewCard></> : null}

    {tab === "relations" ? <ReviewCard target={target.relations} title="CAPA y desviaciones vinculadas">
      <p className="section-help">Expedientes originados por este OOS: CAPA de la investigación y, si procede, una desviación (D-088). La relación se guarda una sola vez como OOS → expediente.</p>
      {record.qmsRecord.sourceRelations.length ? <div className="relation-list">{record.qmsRecord.sourceRelations.map(({ targetRecord: related }) => <div className="relation-card" key={related.id}>
        <span>{related.recordType === "CAPA" ? "CAPA derivada" : "Desviación derivada"}</span>
        <Link href={qmsRecordHref(related.recordType, related.id)}><strong>{qmsRecordDisplayCode(related, qmsRecordTypeLabel(related.recordType))}{!related.isActive ? " · Anulado" : ""}</strong></Link>
        <small>{qmsRecordTypeLabel(related.recordType)}</small>
        {record.qmsRecord.isActive ? <PermissionGate permission="EDIT" recordId={related.id}><form action={unlinkOosRelationAction.bind(null, id, related.id)}><CsrfField /><ActorField type="hidden" name="actor" value={currentActor()} /><button className="button danger small" type="submit">Desvincular</button></form></PermissionGate> : null}
      </div>)}</div> : <div className="empty-panel">Todavía no hay CAPA ni desviaciones vinculadas.</div>}
      {record.status === "DRAFT" ? <div className="empty-panel">Las relaciones se activan al abrir el OOS.</div> : record.qmsRecord.isActive ? <PermissionGate permission="EDIT"><OperationalRelationForm action={addOosRelationAction.bind(null, id)} title="Vincular expediente existente" codeLabel="Codificación" buttonLabel="Vincular expediente" defaultActor={currentActor()} targetOptions={[{ value: "CAPA", label: "CAPA" }, { value: "DEVIATION", label: "Desviación" }]} currentRecordId={record.qmsRecord.id} currentRecordType="OOS" /></PermissionGate> : null}
    </ReviewCard> : null}

    {tab === "documents" ? <div className="card">
      <h2>Anexos del PNT GC-10/014/04</h2>
      {record.status === "DRAFT" ? <div className="empty-panel">Los anexos se generan cuando el OOS está abierto.</div> : <div className="document-grid">
        {(["annex-iii", ...(record.phaseIDisposition === "FULL_SCALE" ? ["annex-iv"] : [])] as OosSignedAnnex[]).map((annex) => {
          const config = oosSignedAnnexes[annex];
          const signed = record.qmsRecord.versions[0]?.documents.find((document) => document.kind === config.kind);
          return <div key={annex} className="document-block featured">
            <h3>{config.label} · {annex === "annex-iii" ? "Fase I: investigación en el laboratorio" : "Fase II: investigación a gran escala"}</h3>
            <p>Genera el Word cumplimentado. Cuando esté firmado a mano, adjunta aquí el PDF escaneado.</p>
            <div className="document-actions">
              {record.qmsRecord.isActive ? <PermissionGate permission={["GENERATE_DOCUMENT", "DOWNLOAD"]}><a className="button primary" href={`/api/oos/${id}/${annex}`}>Generar {config.label} cumplimentado</a></PermissionGate> : null}
              {signed ? <PermissionGate permission="DOWNLOAD"><a className="button" href={`/api/oos/${id}/signed-pdf/${annex}`}>Descargar PDF firmado</a></PermissionGate> : null}
            </div>
            <div className="return-signed-document">
              <strong>{signed ? "PDF firmado disponible" : "PDF firmado pendiente"}</strong>
              <small className="muted-note">{signed ? `${signed.fileName} · ${Math.max(1, Math.round(signed.fileSize / 1024))} KB · cargado ${formatOosDate(signed.uploadedAt)} · ${signed.uploadedByText ?? "Usuario no informado"}` : `Adjunta el PDF firmado del ${config.label} cuando esté disponible.`}</small>
              {record.qmsRecord.isActive ? <PermissionGate permission="ATTACH_DOCUMENT"><SignedVersionDocumentForm reloadOnSuccess action={uploadOosSignedPdfAction.bind(null, id, annex)} defaultActor={currentActor()} replace={Boolean(signed)} /></PermissionGate> : null}
            </div>
          </div>;
        })}
      </div>}
    </div> : null}
    {tab === "review" ? <div className="review-overview">
      <div className="card">
        <div className="section-title-row">
          <div><h2>Revisión del expediente</h2><p className="muted-note">Observaciones sobre el OOS. OOS no utiliza versiones funcionales: las observaciones se refieren al expediente editable.</p></div>
          <PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath, "review", reviewMode), "/oos", returnTo)} /></PermissionGate>
        </div>
        <ReviewStatusSummary />
      </div>
      <ReviewThreadList />
    </div> : null}

    {tab === "timeline" ? <RecordTimeline qmsRecordId={record.qmsRecord.id} /> : null}
    {tab === "audit-trail" ? <AuditTrailPanel rootKey={`QMS_RECORD:${record.qmsRecord.id}`} basePath={basePath} page={Number(auditPage) || 1} /> : null}

    {tab === "history" ? <div className="card">
      <h2>Historial interno de modificaciones</h2>
      <p className="muted-note">Historial operativo del expediente; no constituye audit trail GMP validado.</p>
      {record.qmsRecord.history.length ? <div className="timeline">
        {record.qmsRecord.history.map((item) => <div className="timeline-item history-entry" key={item.id}>
          <header><strong>{formatOosDate(item.changedAt)}</strong><span>{item.changedByText ?? "Sistema"}</span><span className="badge neutral">{item.source}</span></header>
          <p className="history-entry-detail"><strong>{item.fieldPath}</strong>{item.reason ? <span> · Motivo: {item.reason}</span> : null}</p>
        </div>)}
      </div> : <div className="empty-panel">Sin cambios registrados.</div>}
    </div> : null}
  </section>
  <ReviewDrawer />
  </ReviewWorkspaceProvider>;
}

export default async function OosDetailPage(...args: Parameters<typeof OosDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/oos/[id]/page.tsx", () => OosDetailPageAuthenticatedContent(...args), args);
}
