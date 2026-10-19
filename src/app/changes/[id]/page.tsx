import { RecordEvidencePanel } from "@/components/record-evidence-panel";
import { uploadChangeControlEvidenceAction } from "@/lib/qms/record-evidence-actions";
import { RecordTimeline } from "@/components/record-timeline";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { AuditTrailPanel } from "@/components/audit-trail-panel";

import { authorizedPage } from "@/lib/auth/page-guard";
import { appUserOptions } from "@/lib/auth/app-users";
import { ResponsibleUserNote } from "@/components/responsible-user-note";
import Link from "next/link";
import { qmsListingReturnTo, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { notFound } from "next/navigation";
import { ReviewDrawer, ReviewMarker, ReviewModeToggle, ReviewStatusSummary, ReviewThreadList, ReviewWorkspaceProvider } from "@/components/review";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";
import { activeReviewCount, reviewModeHref, reviewTabHref, reviewVersionLabel } from "@/lib/qms/review/ui-model";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { changeControlReviewTargets, changeControlTaskReviewTarget, changeControlFollowupReviewTarget } from "@/lib/qms/review/targets/change-control";
import {
  addChangeControlFollowupAction,
} from "@/modules/change-control/actions";
import { ChangeFollowupForm } from "@/modules/change-control/components/change-followup-form";
import {
  classificationLabel,
  dictamenResultLabel,
  effectivenessStatusLabel,
  executionStatusLabel,
  finalStatusLabel,
  formatDate,
  functionalStatusLabel,
  functionalStatusTone,
  nextFollowupDateFromHistory,
  requestDecisionLabel,
  scopeLabels,
} from "@/modules/change-control/domain";
import {
  changeControlDetailTabs,
  changeControlDocumentUrls,
  changeControlVersionDocumentUrls,
  changeRequirementRows,
  dictamenResultTone,
  displayValue,
  requestDecisionTone,
} from "@/modules/change-control/detail-ui";
import {
  getChangeControlDetail,
  getChangeControlLookups,
} from "@/modules/change-control/queries";
import { recordVersionSummary, versionLabel } from "@/lib/qms/versioning";
import { qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";

import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { RecordHeader } from "@/components/record-header";
import { SignedVersionDocumentForm } from "@/components/signed-version-document-form";
import { uploadChangeControlSignedPdfAction } from "@/modules/change-control/signed-document-actions";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";

export const dynamic = "force-dynamic";

function relationLabel(type: string) {
  return type === "GENERATES" ? "Genera" : "Relacionado";
}

async function ChangeControlDetailPageAuthenticatedContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; review?: string; thread?: string; returnTo?: string; auditPage?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, review, thread, returnTo, auditPage } = await searchParams;
  const activeTab = changeControlDetailTabs.some(([key]) => key === rawTab) ? rawTab! : "information";
  const [record, lookups] = await Promise.all([
    getChangeControlDetail(id),
    getChangeControlLookups(),
  ]);
  if (!record) notFound();
  const users = await appUserOptions([record.followupResponsibleUserId]);

  const currentVersion = record.qmsRecord.versions.at(-1) ?? null;
  const nextFollowupDate = nextFollowupDateFromHistory(record.followups);
  const requirements = changeRequirementRows(record);
  const documentUrls = changeControlDocumentUrls(id);
  const department = [record.departmentCodeSnapshot, record.departmentNameSnapshot]
    .filter(Boolean)
    .join(" · ") || "—";
  const scope = record.scope.map((item) => scopeLabels[item] ?? item).join(" · ") || "—";
  const relations = [
    ...record.qmsRecord.targetRelations.map((item) => ({
      direction: "Origen",
      type: item.relationType,
      record: item.sourceRecord,
    })),
    ...record.qmsRecord.sourceRelations.map((item) => ({
      direction: "Destino",
      type: item.relationType,
      record: item.targetRecord,
    })),
  ];

  const followupTasks = record.tasks.map((item) => {
    const state = item.states[0];
    return {
      id: item.id,
      departmentId: item.departmentId,
      departmentCodeSnapshot: item.departmentCodeSnapshot,
      description: item.description,
      responsible: item.responsible,
      plannedDate: item.plannedDate,
      latestStatus: state?.status,
      latestActualDate: state?.actualDate,
      latestEvidence: state?.evidenceComment,
    };
  });

  const reviewMode = review === "1";
  const basePath = `/changes/${id}`;
  const reviewThreads = await getReviewThreadsForDisplay(record.qmsRecord.id);
  const reviewActiveCount = activeReviewCount({
    PENDING: reviewThreads.filter((item) => item.status === "PENDING").length,
    ACCEPTED: reviewThreads.filter((item) => item.status === "ACCEPTED").length,
  });
  const reviewTarget = {
    infoDescription: reviewTargetWithValue(changeControlReviewTargets.infoDescription, displayValue(record.description)),
    infoDepartment: reviewTargetWithValue(changeControlReviewTargets.infoDepartment, department),
    infoClassification: reviewTargetWithValue(changeControlReviewTargets.infoClassification, classificationLabel(record.classification)),
    infoRequestDate: reviewTargetWithValue(changeControlReviewTargets.infoRequestDate, formatDate(record.requestDate)),
    infoPlannedDate: reviewTargetWithValue(changeControlReviewTargets.infoPlannedDate, formatDate(record.plannedImplementationDate)),
    infoStatus: reviewTargetWithValue(changeControlReviewTargets.infoStatus, functionalStatusLabel(record)),
    requesterName: reviewTargetWithValue(changeControlReviewTargets.requesterName, record.requesterName ?? null),
    requesterPosition: reviewTargetWithValue(changeControlReviewTargets.requesterPosition, record.requesterPosition ?? null),
    scope: reviewTargetWithValue(changeControlReviewTargets.scope, scope),
    description: reviewTargetWithValue(changeControlReviewTargets.description, record.description ?? null),
    justification: reviewTargetWithValue(changeControlReviewTargets.justification, record.justification ?? null),
    providedDocuments: reviewTargetWithValue(changeControlReviewTargets.providedDocuments, record.providedDocuments ?? null),
    requestDecision: reviewTargetWithValue(changeControlReviewTargets.requestDecision, record.requestDecision ?? null),
    requestDecisionResponsible: reviewTargetWithValue(changeControlReviewTargets.requestDecisionResponsible, record.requestDecisionResponsible ?? null),
    requestDecisionRole: reviewTargetWithValue(changeControlReviewTargets.requestDecisionRole, record.requestDecisionRole ?? null),
    requestDecisionDate: reviewTargetWithValue(changeControlReviewTargets.requestDecisionDate, formatDate(record.requestDecisionDate)),
    dictamenResult: reviewTargetWithValue(changeControlReviewTargets.dictamenResult, record.dictamenResult ?? null),
    dictamenDate: reviewTargetWithValue(changeControlReviewTargets.dictamenDate, formatDate(record.dictamenDate)),
    classification: reviewTargetWithValue(changeControlReviewTargets.classification, record.classification ?? null),
    evaluation: reviewTargetWithValue(changeControlReviewTargets.evaluation, record.evaluation ?? null),
    followupResponsible: reviewTargetWithValue(changeControlReviewTargets.followupResponsible, record.followupResponsible ?? null),
    nextFollowupDate: reviewTargetWithValue(changeControlReviewTargets.nextFollowupDate, formatDate(nextFollowupDate)),
    dictamenObservations: reviewTargetWithValue(changeControlReviewTargets.dictamenObservations, record.dictamenObservations ?? null),
  };
  const requirementTargets = new Map(requirements.map((item) => [
    item.key,
    reviewTargetWithValue(changeControlReviewTargets[item.key], { evaluation: item.evaluation, detail: item.detail }),
  ]));
  const taskTargets = record.tasks.map((item) => changeControlTaskReviewTarget(item.id, {
    description: item.description, department: item.departmentCodeSnapshot,
    responsible: item.responsible, plannedDate: formatDate(item.plannedDate),
    origin: item.origin, introducedInFollowup: item.introducedInFollowup,
  }));
  const followupTargets = record.followups.map((item) => changeControlFollowupReviewTarget(item.id, {
    sequenceNumber: item.sequenceNumber, followupDate: formatDate(item.followupDate),
    responsible: item.responsible, executionStatus: item.executionStatus,
    effectivenessStatus: item.effectivenessStatus, nextFollowupDate: formatDate(item.nextFollowupDate),
    observations: item.observations, conclusion: item.conclusion, remainOpenReason: item.remainOpenReason,
    actions: item.taskStates.map((state) => ({
      taskId: state.taskId, description: state.task.description, status: state.status,
      actualDate: formatDate(state.actualDate), evidence: state.evidenceComment,
    })),
  }, item.sequenceNumber));
  const taskTargetById = new Map(taskTargets.map((target) => [target.targetEntityId!, target]));
  const followupTargetById = new Map(followupTargets.map((target) => [target.targetEntityId!, target]));
  const reviewTargets = [...Object.values(reviewTarget), ...requirementTargets.values(), ...taskTargets, ...followupTargets];

  return (
    <ReviewWorkspaceProvider qmsRecordId={record.qmsRecord.id} module="CHANGE_CONTROL" basePath={basePath}
      currentVersionLabel={reviewVersionLabel(currentVersion?.sequenceNumber ?? null, "FOLLOWUP")}
      versionLabelMode="FOLLOWUP" defaultActor={currentActor()}
      reviewMode={reviewMode} targets={reviewTargets} threads={reviewThreads} initialThreadId={thread}>
    <section className={`workspace${reviewMode ? " review-mode-active" : ""}`}>
      <RecordHeader
        back={{ href: qmsListingReturnTo("/changes", returnTo), label: "Controles de Cambios" }}
        title={qmsRecordDisplayCode(record.qmsRecord, "Control de Cambio sin código")}
        chips={<>
          <span className="badge neutral">{classificationLabel(record.classification)}</span>
          <span className={`badge ${record.executionStatus === "EXECUTED" ? "closed" : "warning"}`}>{executionStatusLabel(record.executionStatus)}</span>
          <span className={`badge ${record.effectivenessStatus === "ACCEPTABLE" ? "closed" : record.effectivenessStatus === "NOT_ACCEPTABLE" ? "major" : record.effectivenessStatus === "NOT_APPLICABLE" ? "neutral" : "warning"}`}>Eficacia {effectivenessStatusLabel(record.effectivenessStatus)}</span>
          <span className={`badge ${record.finalStatus === "CLOSED" ? "closed" : record.finalStatus === "DRAFT" ? "neutral" : "open"}`}>{finalStatusLabel(record.finalStatus)}</span>
          <span className={`badge ${functionalStatusTone(record)}`}>{functionalStatusLabel(record)}</span>
          {currentVersion ? <span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span> : null}
        </>}
        subtitle={<>Solicitud {formatDate(record.requestDate)} · {record.departmentCodeSnapshot ?? "Sin departamento"} · Dictamen {dictamenResultLabel(record.dictamenResult)}</>}
        annul={<QmsAdministrativeStatus part="action"
        qmsRecordId={record.qmsRecord.id}
        isActive={record.qmsRecord.isActive}
        code={qmsRecordDisplayCode(record.qmsRecord)}
        annulledAt={record.qmsRecord.annulledAt?.toISOString() ?? null}
        annulledByText={record.qmsRecord.annulledByText}
        annulledReason={record.qmsRecord.annulledReason}
        defaultActor={currentActor()}
      />}
        actions={<>
          <PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath, activeTab, reviewMode), "/changes", returnTo)} /></PermissionGate>
          {record.dictamenResult === "APPROVED" && record.finalStatus === "OPEN" ? (
            <PermissionGate permission="FOLLOWUP"><Link className="button" href={qmsWithReturnTo(`${reviewTabHref(basePath, "followups", reviewMode)}#new-followup`, "/changes", returnTo)}>+ Seguimiento</Link></PermissionGate>
          ) : null}
          <PermissionGate permission="EDIT" form><Link className="button primary" href={qmsWithReturnTo(`/changes/${id}/edit?tab=${activeTab}`, "/changes", returnTo)}>Editar Solicitud / Dictamen</Link></PermissionGate>
        </>}
      />
      <QmsAdministrativeStatus part="banner"
        qmsRecordId={record.qmsRecord.id}
        isActive={record.qmsRecord.isActive}
        code={qmsRecordDisplayCode(record.qmsRecord)}
        annulledAt={record.qmsRecord.annulledAt?.toISOString() ?? null}
        annulledByText={record.qmsRecord.annulledByText}
        annulledReason={record.qmsRecord.annulledReason}
        defaultActor={currentActor()}
      />

      {record.finalStatus === "DRAFT" ? (
        <div className="analytics-note">
          <strong>Borrador:</strong> este expediente todavía no es un Control de Cambio operativo. Completa los campos obligatorios y cambia el estado a Abierto para iniciar su ciclo formal.
        </div>
      ) : null}


      <nav className="record-tabs">
        {changeControlDetailTabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={qmsWithReturnTo(reviewTabHref(basePath, key, reviewMode), "/changes", returnTo)}>
            {key === "review" ? `Revisión (${reviewActiveCount})` : label}
          </Link>
        ))}
      </nav>

      {activeTab === "information" ? (
        <div className="card change-overview-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Resumen del expediente</p>
              <h2>Información</h2>
            </div>
            <div id={reviewTarget.infoStatus.anchorId} className="review-target"><span className={`badge ${functionalStatusTone(record)}`}>{functionalStatusLabel(record)}</span><ReviewMarker target={reviewTarget.infoStatus} /></div>
          </div>
          <section id={reviewTarget.infoDescription.anchorId} className="review-target change-overview-description">
            <h3 className="review-target-heading"><span>Descripción del cambio</span><ReviewMarker target={reviewTarget.infoDescription} /></h3>
            <p>{displayValue(record.description)}</p>
          </section>
          <dl className="change-overview-meta">
            <div className="info-item"><dt>Código</dt><dd>{record.qmsRecord.businessCode ?? "—"}</dd></div>
            <div id={reviewTarget.infoDepartment.anchorId} className="review-target info-item"><dt><span>Departamento</span><ReviewMarker target={reviewTarget.infoDepartment} /></dt><dd>{department}</dd></div>
            <div id={reviewTarget.infoClassification.anchorId} className="review-target info-item"><dt><span>Clasificación</span><ReviewMarker target={reviewTarget.infoClassification} /></dt><dd><span className="badge neutral">{classificationLabel(record.classification)}</span></dd></div>
          </dl>
          <dl className="change-date-pair">
            <div id={reviewTarget.infoRequestDate.anchorId} className="review-target">
              <dt><span>Fecha de solicitud</span><ReviewMarker target={reviewTarget.infoRequestDate} /></dt>
              <dd>{formatDate(record.requestDate)}</dd>
            </div>
            <div id={reviewTarget.infoPlannedDate.anchorId} className="review-target">
              <dt><span>Fecha prevista de implementación</span><ReviewMarker target={reviewTarget.infoPlannedDate} /></dt>
              <dd>{formatDate(record.plannedImplementationDate)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {activeTab === "request" ? (
        <div className="card change-detail-card">
          <div className="section-title-row">
            <div><p className="eyebrow">Anexo III</p><h2>Solicitud</h2></div>
          </div>
          <section className="change-detail-section">
            <h3>Datos del solicitante</h3>
            <dl className="info-grid">
              <div id={reviewTarget.requesterName.anchorId} className="review-target info-item"><dt><span>Solicitante</span><ReviewMarker target={reviewTarget.requesterName} /></dt><dd>{displayValue(record.requesterName)}</dd></div>
              <div id={reviewTarget.requesterPosition.anchorId} className="review-target info-item"><dt><span>Cargo / puesto</span><ReviewMarker target={reviewTarget.requesterPosition} /></dt><dd>{displayValue(record.requesterPosition)}</dd></div>
              <div className="info-item"><dt>Departamento</dt><dd>{department}</dd></div>
              <div className="info-item"><dt>Fecha de solicitud</dt><dd>{formatDate(record.requestDate)}</dd></div>
              <div id={reviewTarget.scope.anchorId} className="review-target info-item full"><dt><span>Ámbito del cambio</span><ReviewMarker target={reviewTarget.scope} /></dt><dd>{scope}{record.otherScope ? ` · ${record.otherScope}` : ""}</dd></div>
            </dl>
          </section>
          <section id={reviewTarget.description.anchorId} className="review-target change-prose-section">
            <h3 className="review-target-heading"><span>Descripción del cambio</span><ReviewMarker target={reviewTarget.description} /></h3>
            <p>{displayValue(record.description)}</p>
          </section>
          <section id={reviewTarget.justification.anchorId} className="review-target change-prose-section">
            <h3 className="review-target-heading"><span>Justificación del cambio</span><ReviewMarker target={reviewTarget.justification} /></h3>
            <p>{displayValue(record.justification)}</p>
          </section>
          <section id={reviewTarget.providedDocuments.anchorId} className="review-target change-prose-section">
            <h3 className="review-target-heading"><span>Documentos aportados</span><ReviewMarker target={reviewTarget.providedDocuments} /></h3>
            <p>{displayValue(record.providedDocuments)}</p>
          </section>
          <section className="change-decision-panel">
            <div className="change-decision-heading">
              <div id={reviewTarget.requestDecision.anchorId} className="review-target"><p className="eyebrow">Decisión</p><h3 className="review-target-heading"><span>Decisión de la solicitud</span><ReviewMarker target={reviewTarget.requestDecision} /></h3></div>
              <span className={`badge ${requestDecisionTone(record.requestDecision)}`}>{requestDecisionLabel(record.requestDecision)}</span>
            </div>
            <dl className="info-grid">
              <div id={reviewTarget.requestDecisionResponsible.anchorId} className="review-target info-item"><dt><span>Responsable de dictamen</span><ReviewMarker target={reviewTarget.requestDecisionResponsible} /></dt><dd>{displayValue(record.requestDecisionResponsible)}<ResponsibleUserNote user={record.requestDecisionResponsibleUser} /></dd></div>
              <div id={reviewTarget.requestDecisionRole.anchorId} className="review-target info-item"><dt><span>Cargo / función</span><ReviewMarker target={reviewTarget.requestDecisionRole} /></dt><dd>{displayValue(record.requestDecisionRole)}</dd></div>
              <div id={reviewTarget.requestDecisionDate.anchorId} className="review-target info-item"><dt><span>Fecha de aceptación/denegación</span><ReviewMarker target={reviewTarget.requestDecisionDate} /></dt><dd>{formatDate(record.requestDecisionDate)}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}

      {activeTab === "dictamen" ? (
        <>
          <div className="card change-dictamen-result">
            <div id={reviewTarget.dictamenResult.anchorId} className="review-target">
              <p className="eyebrow">Anexo IV</p>
              <h2 className="review-target-heading"><span>Resultado del dictamen</span><ReviewMarker target={reviewTarget.dictamenResult} /></h2>
              <span className={`badge ${dictamenResultTone(record.dictamenResult)}`}>{dictamenResultLabel(record.dictamenResult)}</span>
            </div>
            <dl>
              <div id={reviewTarget.dictamenDate.anchorId} className="review-target"><dt><span>Fecha del dictamen</span><ReviewMarker target={reviewTarget.dictamenDate} /></dt><dd>{formatDate(record.dictamenDate)}</dd></div>
              <div id={reviewTarget.classification.anchorId} className="review-target"><dt><span>Clasificación</span><ReviewMarker target={reviewTarget.classification} /></dt><dd>{classificationLabel(record.classification)}</dd></div>
            </dl>
          </div>

          <div id={reviewTarget.evaluation.anchorId} className="review-target card change-evaluation-card">
            <h2 className="review-target-heading"><span>Evaluación del cambio</span><ReviewMarker target={reviewTarget.evaluation} /></h2>
            <p>{displayValue(record.evaluation)}</p>
          </div>

          <div className="card">
            <div className="section-title-row">
              <div>
                <h2>Implicación del cambio y requisitos</h2>
                <p className="muted-note">Cada requisito conserva su evaluación y la respuesta o justificación asociada.</p>
              </div>
            </div>
            <div className="change-requirements" role="table" aria-label="Implicación del cambio y requisitos">
              <div className="change-requirement-header" role="row">
                <strong role="columnheader">Requisito</strong>
                <strong role="columnheader">Evaluación</strong>
                <strong role="columnheader">Respuesta / justificación</strong>
              </div>
              {requirements.map((item) => (
                <div id={requirementTargets.get(item.key)!.anchorId} className="change-requirement-row review-target" role="row" key={item.key}>
                  <div role="cell"><span className="change-mobile-label">Requisito</span><strong>{item.question}</strong><ReviewMarker target={requirementTargets.get(item.key)!} /></div>
                  <div role="cell"><span className="change-mobile-label">Evaluación</span><span className="badge neutral">{item.evaluation}</span></div>
                  <div role="cell"><span className="change-mobile-label">Respuesta / justificación</span><span>{item.detail}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card change-plan-card">
            <h2>Plan de ejecución aprobado</h2>
            <p className="muted-note">El plan aprobado constituye la línea base del cambio.</p>
            <div className="table-scroll">
              <table className="records-table compact-table">
                <thead><tr><th>Origen</th><th>Departamento</th><th>Acción / tarea</th><th>Responsable</th><th>Fecha prevista</th></tr></thead>
                <tbody>
                  {record.tasks.map((item) => (
                    <tr id={taskTargetById.get(item.id)!.anchorId} key={item.id} className={`review-target ${item.origin === "FOLLOWUP" ? "followup-new-task" : ""}`}>
                      <td>{item.origin === "FOLLOWUP" ? <span className="badge new-task">NUEVA S{String(item.introducedInFollowup ?? 0).padStart(2,"0")}</span> : <span className="badge neutral">DICTAMEN</span>}</td>
                      <td>{item.departmentCodeSnapshot ?? "—"}</td>
                      <td className="table-cell-wrap"><span>{item.description}</span><ReviewMarker target={taskTargetById.get(item.id)!} /></td>
                      <td>{item.responsible ?? "—"}<ResponsibleUserNote user={item.responsibleUser} /></td>
                      <td>{formatDate(item.plannedDate)}</td>
                    </tr>
                  ))}
                  {!record.tasks.length ? <tr><td colSpan={5}>Sin acciones registradas.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card change-dictamen-closing">
            <section>
              <h2>Seguimiento previsto</h2>
              <dl className="info-grid">
                <div id={reviewTarget.followupResponsible.anchorId} className="review-target info-item wide"><dt><span>Responsable de seguimiento</span><ReviewMarker target={reviewTarget.followupResponsible} /></dt><dd>{displayValue(record.followupResponsible)}<ResponsibleUserNote user={record.followupResponsibleUser} /></dd></div>
                <div id={reviewTarget.nextFollowupDate.anchorId} className="review-target info-item wide"><dt><span>Fecha del próximo seguimiento</span><ReviewMarker target={reviewTarget.nextFollowupDate} /></dt><dd>{nextFollowupDate ? formatDate(nextFollowupDate) : "Pendiente de establecer en el seguimiento"}</dd></div>
              </dl>
            </section>
            <section id={reviewTarget.dictamenObservations.anchorId} className="review-target change-prose-section">
              <h2 className="review-target-heading"><span>Observaciones</span><ReviewMarker target={reviewTarget.dictamenObservations} /></h2>
              <p>{displayValue(record.dictamenObservations)}</p>
            </section>
            <section className="change-internal-panel">
              <div>
                <p className="eyebrow">Gestión interna</p>
                <h2>Control interno</h2>
              </div>
              <dl className="info-grid">
                <div className="info-item full"><dt>Observaciones internas</dt><dd className="prose-value">{displayValue(record.internalObservations)}</dd></div>
                <div className="info-item"><dt>Documento firmado disponible</dt><dd>{record.signedDocumentAvailable === true ? "Sí" : record.signedDocumentAvailable === false ? "No" : "—"}</dd></div>
                <div className="info-item"><dt>Control del dato</dt><dd>{record.dataQualityStatus === "COMPLETE" ? "Completo" : record.dataQualityStatus === "INCOMPLETE" ? "Incompleto" : "Pendiente de revisar"}</dd></div>
              </dl>
            </section>
          </div>
        </>
      ) : null}

      {activeTab === "followups" ? (
        record.finalStatus === "DRAFT" ? (
          <div className="empty-panel">Los seguimientos estarán disponibles cuando el Control de Cambio pase a estado Abierto.</div>
        ) : <>
          <div className="card">
            <div className="section-title-row">
              <div>
                <h2>Seguimientos · Anexo V</h2>
                <p className="muted-note">Numeración formal 00, 01, 02… Cada seguimiento conserva un snapshot completo e inmutable al crear el siguiente.</p>
              </div>
              <span className="badge neutral">{record.followups.length} seguimiento(s)</span>
            </div>
            {record.followups.length ? (
              <div className="timeline">
                {record.followups.map((item) => {
                  const version = record.qmsRecord.versions.find((entry) => entry.sequenceNumber === item.sequenceNumber) ?? null;
                  const signedDocument = version?.documents[0] ?? null;
                  return (
                    <article id={followupTargetById.get(item.id)!.anchorId} className="timeline-item review-target" key={item.id}>
                      <div className="timeline-marker">{String(item.sequenceNumber).padStart(2,"0")}</div>
                      <div>
                        <header>
                          <strong>Seguimiento {String(item.sequenceNumber).padStart(2,"0")}{item.sequenceNumber === 0 ? " · Apertura" : ""} · {formatDate(item.followupDate)}</strong><ReviewMarker target={followupTargetById.get(item.id)!} />
                          <span className={`badge ${item.executionStatus === "EXECUTED" ? "closed" : "warning"}`}>{executionStatusLabel(item.executionStatus)}</span>
                          <span className={`badge ${item.effectivenessStatus === "ACCEPTABLE" ? "closed" : item.effectivenessStatus === "NOT_ACCEPTABLE" ? "major" : item.effectivenessStatus === "NOT_APPLICABLE" ? "neutral" : "warning"}`}>{effectivenessStatusLabel(item.effectivenessStatus)}</span>
                        </header>
                        <p>Responsable: {item.responsible}{item.responsibleUser ? ` (usuario: ${item.responsibleUser.displayName})` : ""} · Próximo: {formatDate(item.nextFollowupDate)}</p>
                        {item.remainOpenReason ? <p><strong>Motivo abierto:</strong> {item.remainOpenReason}</p> : null}
                        {item.conclusion ? <p><strong>Conclusión:</strong> {item.conclusion}</p> : null}
                        <div className="document-actions">
                          <PermissionGate permission={item.closeChange ? ["FOLLOWUP", "CLOSE"] : "FOLLOWUP"}><Link className="button small" href={`/changes/${id}/followups/${item.sequenceNumber}/edit`}>
                            Editar seguimiento
                          </Link></PermissionGate>
                          <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={`/api/changes/${id}/annex-v?version=${item.sequenceNumber}`}>
                            Descargar Anexo V · {String(item.sequenceNumber).padStart(2,"0")}
                          </a></PermissionGate>
                          {signedDocument ? (
                            <PermissionGate permission="DOWNLOAD"><a className="button small" href={`/api/changes/${id}/versions/${item.sequenceNumber}/signed-pdf`}>
                              Descargar PDF firmado
                            </a></PermissionGate>
                          ) : null}
                        </div>
                        {version ? (
                          <div className="version-signed-document">
                            <strong>{signedDocument ? "PDF firmado adjuntado" : "PDF firmado pendiente"}</strong>
                            {signedDocument ? (
                              <small className="muted-note">
                                {signedDocument.fileName} · {Math.max(1, Math.round(signedDocument.fileSize / 1024))} KB
                              </small>
                            ) : (
                              <small className="muted-note">La carga es documental; no se añade una nueva regla de cierre.</small>
                            )}
                            <PermissionGate permission="ATTACH_DOCUMENT"><details className="signed-pdf-details">
                              <summary>{signedDocument ? "Sustituir PDF firmado" : "Adjuntar PDF firmado"}</summary>
                              <PermissionGate permission="ATTACH_DOCUMENT"><SignedVersionDocumentForm
                                action={uploadChangeControlSignedPdfAction.bind(null, id, version.id)}
                                defaultActor={currentActor()}
                                replace={Boolean(signedDocument)}
                              /></PermissionGate>
                            </details></PermissionGate>
                          </div>
                        ) : null}
                        <div className="table-scroll followup-state-table">
                          <table className="records-table compact-table">
                            <thead><tr><th>Origen</th><th>Departamento</th><th>Acción</th><th>Estado</th><th>Fecha real</th><th>Evidencia</th></tr></thead>
                            <tbody>
                              {item.taskStates.map((state) => (
                                <tr key={state.id} className={state.task.origin === "FOLLOWUP" ? "followup-new-task" : ""}>
                                  <td>{state.task.origin === "FOLLOWUP" ? <span className="badge new-task">NUEVA S{String(state.task.introducedInFollowup ?? 0).padStart(2,"0")}</span> : "DICTAMEN"}</td>
                                  <td>{state.task.departmentCodeSnapshot ?? "—"}</td>
                                  <td className="table-cell-wrap">{state.task.description}</td>
                                  <td>{state.status === "COMPLETED" ? "Completada" : state.status === "NOT_APPLICABLE" ? "No aplica" : "Pendiente"}</td>
                                  <td>{formatDate(state.actualDate)}</td>
                                  <td className="table-cell-wrap">{state.evidenceComment ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-panel">Todavía no se ha emitido el seguimiento 00.</div>
            )}
          </div>

          {record.qmsRecord.versions.length ? (
            <div className="card">
              <h2>Versiones históricas de seguimiento</h2>
              <div className="timeline">
                {record.qmsRecord.versions.map((item) => {
                  const summary = recordVersionSummary("CHANGE_CONTROL", item.snapshot);
                  return (
                    <div className="timeline-item" key={item.id}>
                      <div className="timeline-marker">{String(item.sequenceNumber).padStart(2,"0")}</div>
                      <div>
                        <header>
                          <strong>{versionLabel(item.sequenceNumber)} · Seguimiento {String(item.sequenceNumber).padStart(2,"0")}</strong>
                          {item.frozenAt ? <span className="badge neutral">Histórica</span> : <span className="badge neutral">Vigente</span>}
                        </header>
                        <p>Estado: {finalStatusLabel(summary.status ?? "OPEN")} · Eficacia: {effectivenessStatusLabel(summary.effectivenessStatus ?? "PENDING")} · Próximo: {formatDate(summary.nextFollowupDate)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {record.dictamenResult === "APPROVED" && record.finalStatus === "OPEN" ? (
            <div className="card" id="new-followup">
              <h2>Nuevo seguimiento</h2>
              <PermissionGate permission="FOLLOWUP"><ChangeFollowupForm
                action={addChangeControlFollowupAction.bind(null, id)}
                departments={lookups.departments}
                tasks={followupTasks}
                users={users}
                defaultResponsible={record.followupResponsible}
                defaultResponsibleUserId={record.followupResponsibleUserId}
              /></PermissionGate>
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === "documents" ? (
        record.finalStatus === "DRAFT" ? (
          <div className="empty-panel">Los documentos oficiales estarán disponibles cuando el Control de Cambio pase a estado Abierto.</div>
        ) : <div className="card change-documents-card">
          <div className="section-title-row">
            <div>
              <h2>Documentos del expediente</h2>
              <p className="muted-note">Anexos generables, documentos por seguimiento y generaciones registradas.</p>
            </div>
          </div>
          <h3 className="change-document-group-title">Anexos generables</h3>
          <div className="document-grid">
            <div className="document-block">
              <div className="change-document-heading"><h3>Anexo III · Solicitud</h3><span className="badge neutral">{record.annexIIITemplateVersion?.versionCode ?? "Sin plantilla"}</span></div>
              <p>Plantilla oficial y solicitud cumplimentada del Control de Cambio.</p>
              <div className="document-actions">
                {record.annexIIITemplateVersion?.id ? <PermissionGate permission="DOWNLOAD" module="CHANGE_CONTROL"><a className="button" href={`/api/settings/templates/${record.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a></PermissionGate> : <span className="muted-note">Plantilla pendiente de cargar.</span>}
                <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button primary" href={documentUrls.annexIII}>Generar Anexo III</a></PermissionGate>
              </div>
            </div>
            <div className="document-block">
              <div className="change-document-heading"><h3>Anexo IV · Dictamen</h3><span className="badge neutral">{record.annexIVTemplateVersion?.versionCode ?? "Sin plantilla"}</span></div>
              <p>Plantilla oficial y Dictamen cumplimentado.</p>
              <div className="document-actions">
                {record.annexIVTemplateVersion?.id ? <PermissionGate permission="DOWNLOAD" module="CHANGE_CONTROL"><a className="button" href={`/api/settings/templates/${record.annexIVTemplateVersion.id}/download`}>Descargar plantilla oficial</a></PermissionGate> : <span className="muted-note">Plantilla pendiente de cargar.</span>}
                <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button primary" href={documentUrls.annexIV}>Generar Anexo IV</a></PermissionGate>
              </div>
            </div>
            <div className="document-block">
              <div className="change-document-heading"><h3>Anexo V · Seguimiento</h3><span className="badge neutral">{record.annexVTemplateVersion?.versionCode ?? "Sin plantilla"}</span></div>
              <p>Cada seguimiento se genera con su versión histórica correspondiente.</p>
              <div className="document-actions">
                {record.annexVTemplateVersion?.id ? <PermissionGate permission="DOWNLOAD" module="CHANGE_CONTROL"><a className="button" href={`/api/settings/templates/${record.annexVTemplateVersion.id}/download`}>Descargar plantilla oficial</a></PermissionGate> : null}
                {currentVersion ? <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button primary" href={changeControlVersionDocumentUrls(id, currentVersion.sequenceNumber).annexV}>Generar Anexo V · {versionLabel(currentVersion.sequenceNumber)}</a></PermissionGate> : <span className="badge neutral">Disponible tras Seguimiento 00</span>}
              </div>
            </div>
            <div className="document-block">
              <div className="change-document-heading"><h3>Anexo VII · Listado maestro</h3><span className="badge neutral">Anual</span></div>
              <p>Listado oficial anual de Controles de Cambios.</p>
              <PermissionGate permission="EXPORT"><Link className="button" href={documentUrls.annexVII}>Ir al listado y descargar Anexo VII</Link></PermissionGate>
            </div>
          </div>
          {record.qmsRecord.versions.length ? (
            <section className="change-document-group">
              <h3>Documentos por seguimiento</h3>
              <div className="record-version-list">
                {record.qmsRecord.versions.map((version) => {
                  const urls = changeControlVersionDocumentUrls(id, version.sequenceNumber);
                  return (
                    <article className="record-version-item" key={version.id}>
                      <div className="record-version-header">
                        <strong>{versionLabel(version.sequenceNumber)} · Seguimiento {String(version.sequenceNumber).padStart(2,"0")}</strong>
                        <span className="badge neutral">{version.frozenAt ? "Histórica" : "Vigente"}</span>
                      </div>
                      <div className="document-actions">
                        <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={urls.annexV}>
                          Descargar Anexo V histórico
                        </a></PermissionGate>
                        <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={urls.annexIII}>
                          Solicitud en esta versión
                        </a></PermissionGate>
                        <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={urls.annexIV}>
                          Dictamen en esta versión
                        </a></PermissionGate>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
          {record.qmsRecord.generatedDocuments.length ? (
            <section className="change-document-group">
              <h3>Generaciones registradas</h3>
              <div className="timeline">
                {record.qmsRecord.generatedDocuments.map((item) => (
                  <div className="timeline-item document-generation-item" key={item.id}>
                    <strong className="document-generation-type">{item.documentType}</strong>
                    <small className="muted-note document-generation-meta">Generado {formatDate(item.generatedAt)} · {item.generatedByText ?? "Usuario no informado"}</small>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="change-document-group"><h3>Generaciones registradas</h3><div className="empty-panel">Todavía no se han generado documentos desde la aplicación.</div></section>
          )}
        </div>
      ) : null}

      {activeTab === "relations" ? (
        record.finalStatus === "DRAFT" ? (
          <div className="empty-panel">Las relaciones operativas estarán disponibles cuando el Control de Cambio pase a estado Abierto.</div>
        ) : <div className="card">
          <h2>Expedientes relacionados</h2>
          {relations.length ? (
            <div className="relation-list">
              {relations.map((item, index) => (
                <div className="relation-card" key={`${item.record.id}-${item.type}-${index}`}>
                  <span>{item.direction} · {relationLabel(item.type)}</span>
                  <Link href={qmsRecordHref(item.record.recordType, item.record.id)}>
                    <strong>{item.record.businessCode ?? qmsRecordTypeLabel(item.record.recordType)}</strong>
                  </Link>
                  <small>{qmsRecordTypeLabel(item.record.recordType)}</small>
                </div>
              ))}
            </div>
          ) : <div className="empty-panel">Sin expedientes relacionados.</div>}
          <p className="muted-note">Control de Cambios no admite relaciones operativas con otros módulos en V1.</p>
        </div>
      ) : null}

      {activeTab === "review" ? (
        <div className="card"><h2>Revisión del expediente</h2><ReviewStatusSummary /><ReviewThreadList /></div>
      ) : null}

      {activeTab === "evidence" ? <RecordEvidencePanel qmsRecordId={record.qmsRecord.id} active={record.qmsRecord.isActive} action={uploadChangeControlEvidenceAction.bind(null, record.id)} /> : null}
      {activeTab === "timeline" ? <RecordTimeline qmsRecordId={record.qmsRecord.id} /> : null}
      {activeTab === "audit-trail" ? <AuditTrailPanel rootKey={`QMS_RECORD:${record.qmsRecord.id}`} basePath={basePath} page={Number(auditPage)||1}/> : null}
    </section>
    <ReviewDrawer />
    </ReviewWorkspaceProvider>
  );
}

export default async function ChangeControlDetailPage(...args: Parameters<typeof ChangeControlDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/changes/[id]/page.tsx", () => ChangeControlDetailPageAuthenticatedContent(...args), args);
}
