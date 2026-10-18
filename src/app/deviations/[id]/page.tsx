import { getSimilarDeviations } from "@/modules/deviations/recurrence-queries";
import { SimilarDeviations } from "@/modules/deviations/components/similar-deviations";
import { storedAdditionalLots } from "@/lib/qms/additional-lots";
import { rootCauseCategoryLabel } from "@/lib/qms/root-cause-categories";
import { RecordEvidencePanel } from "@/components/record-evidence-panel";
import { uploadDeviationEvidenceAction } from "@/lib/qms/record-evidence-actions";
import { RecordTimeline } from "@/components/record-timeline";
import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { AuditTrailPanel } from "@/components/audit-trail-panel";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import { AuditOriginPanel } from "@/modules/audits/origin-panel";
import { OosOriginPanel } from "@/modules/oos/origin-panel";
import Link from "next/link";
import { qmsListingReturnTo, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { notFound } from "next/navigation";
import { addDeviationRelationAction, unlinkDeviationCapaAction } from "@/modules/deviations/actions";
import { deadlineLabel, formatDate, measuresLabel, triStateLabel } from "@/modules/deviations/domain";
import { getDeviationDetail } from "@/modules/deviations/queries";
import { recordVersionSummary, versionLabel } from "@/lib/qms/versioning";
import { qmsRecordHref } from "@/lib/qms/record-links";
import {
  capaPlanNavigation,
  capaProposalStatusLabel,
} from "@/modules/capa/proposal-ui";
import { OperationalRelationForm } from "@/components/operational-relation-form";
import { ResponsibleUserNote } from "@/components/responsible-user-note";
import { uploadDeviationSignedPdfAction } from "@/modules/deviations/signed-document-actions";
import { SignedVersionDocumentForm } from "@/components/signed-version-document-form";

import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import {
  ReviewDrawer,
  ReviewMarker,
  ReviewModeToggle,
  ReviewStatusSummary,
  ReviewThreadList,
  ReviewWorkspaceProvider,
} from "@/components/review";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";
import {
  activeReviewCount,
  reviewModeHref,
  reviewTabHref,
  reviewVersionLabel,
} from "@/lib/qms/review/ui-model";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import {
  deviationCapaPlanReviewTarget,
  deviationImmediateActionReviewTarget,
  deviationReviewTargets,
} from "@/lib/qms/review/targets/deviations";

export const dynamic = "force-dynamic";

const tabs = [
  ["summary", "Resumen"],
  ["description", "Descripción"],
  ["investigation", "Investigación"],
  ["actions", "Acciones"],
  ["conclusion", "Conclusión"],
  ["relations", "Relaciones"],
  ["versions", "Versiones"],
  ["documents", "Documentos"],
  ["evidence", "Evidencias"],
  ["review", "Revisión"],
  ["timeline", "Cronología"],
  ["audit-trail", "Audit Trail"],
] as const;

function text(value: string | null | undefined) {
  return value || "—";
}

function classificationLabel(value: string | null) {
  if (value === "CRITICAL") return "Crítica";
  if (value === "MAJOR") return "Mayor";
  if (value === "MINOR") return "Menor";
  return "Sin clasificar";
}

function provenanceLabel(value: string | null) {
  const labels: Record<string, string> = {
    FINISHED_PRODUCT_SYSTEM: "Producto terminado / Sistema",
    CLIENT: "Cliente",
    RAW_PACKAGING_MATERIAL: "Materia prima / Material de acondicionamiento",
    SUPPLIER: "Proveedor",
    EQUIPMENT_LINE: "Equipo / Línea afectada",
    OTHER: "Otros",
    DOCUMENTATION: "Documentación",
    PROCESS: "Proceso",
    EQUIPMENT: "Equipo",
    MATERIAL: "Material",
  };
  return value ? labels[value] ?? value : "—";
}

function dataQualityLabel(value: string) {
  if (value === "COMPLETE") return "Completo";
  if (value === "INCOMPLETE") return "Incompleto";
  return "Revisión necesaria";
}

function investigationMethodLabel(value: string) {
  const labels: Record<string, string> = {
    BRAINSTORMING: "Brainstorming",
    FIVE_WHYS: "5 porqués",
    FTA: "Árbol de fallos (FTA)",
    ISHIKAWA: "Ishikawa",
  };
  return labels[value] ?? value;
}

function investigationResultLabel(value: string | null) {
  if (value === "YES") return "Concluyente";
  if (value === "NO") return "No concluyente";
  if (value === "NA") return "No aplica";
  return "No informado";
}

async function DeviationDetailPageAuthenticatedContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; review?: string; thread?: string; returnTo?: string; auditPage?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, review, thread, returnTo, auditPage } = await searchParams;
  const activeTab = tabs.some(([key]) => key === rawTab) ? rawTab! : "summary";
  const deviation = await getDeviationDetail(id);
  if (!deviation) notFound();
  const similarDeviations = await getSimilarDeviations(deviation);

  const code = qmsRecordDisplayCode(deviation.qmsRecord, "Sin codificación");
  const currentVersion = deviation.qmsRecord.versions.at(-1) ?? null;
  const currentSignedDocument = currentVersion?.documents.find((document) => document.kind === "SIGNED_PDF") ?? null;
  const reviewMode = review === "1";
  const basePath = `/deviations/${id}`;
  const reviewThreads = await getReviewThreadsForDisplay(deviation.qmsRecord.id);
  const reviewActiveCount = activeReviewCount({
    PENDING: reviewThreads.filter((item) => item.status === "PENDING").length,
    ACCEPTED: reviewThreads.filter((item) => item.status === "ACCEPTED").length,
  });
  const relatedCapas = deviation.qmsRecord.sourceRelations
    .filter(
      (relation) =>
        relation.relationType === "GENERATES" &&
        relation.targetRecord.recordType === "CAPA",
    )
    .map((relation) => relation.targetRecord);
  const originDetails = [
    { label: "Procedencia", value: deviation.provenance ? provenanceLabel(deviation.provenance) : null },
    { label: "Proceso / equipo / sistema", value: deviation.processEquipmentSystem },
    { label: "Sistema de producto terminado", value: deviation.finishedProductSystem },
    { label: "Lote de producto", value: deviation.productLot },
    { label: "Tamaño de lote", value: deviation.lotSize },
    { label: "Cantidad afectada", value: deviation.affectedQuantity },
    { label: "Cliente", value: deviation.client },
    { label: "Materia prima / material de acondicionamiento", value: deviation.rawOrPackagingMaterial },
    { label: "Lote de material", value: deviation.materialLot },
    { label: "Tamaño de lote de material", value: deviation.materialLotSize },
    { label: "Cantidad de material afectada", value: deviation.materialAffectedQuantity },
    { label: "Proveedor", value: deviation.supplier },
    { label: "Lote del proveedor", value: deviation.supplierLot },
    { label: "Otros lotes afectados", value: storedAdditionalLots(deviation.additionalLots).map((lot) => [lot.kind === "MATERIAL" ? "Material" : "Producto", lot.name, `lote ${lot.lot}`, lot.quantity && `cantidad ${lot.quantity}`].filter(Boolean).join(" · ")).join("; ") || null },
    { label: "Equipo / línea afectada", value: deviation.affectedEquipmentLine },
    { label: "Documentación afectada", value: deviation.affectedDocumentation },
    { label: "Otro origen", value: deviation.otherOrigin },
  ].filter((item) => Boolean(item.value?.trim()));

  const reviewTarget = {
    materialProcessAffected: reviewTargetWithValue(
      deviationReviewTargets.materialProcessAffected,
      deviation.materialProcessAffected,
    ),
    classification: reviewTargetWithValue(
      deviationReviewTargets.classification,
      classificationLabel(deviation.classification),
    ),
    origin: reviewTargetWithValue(
      deviationReviewTargets.origin,
      originDetails.map((item) => `${item.label}: ${item.value}`),
    ),
    whatHappened: reviewTargetWithValue(
      deviationReviewTargets.whatHappened,
      deviation.whatHappened,
    ),
    whoInvolved: reviewTargetWithValue(
      deviationReviewTargets.whoInvolved,
      deviation.whoInvolved,
    ),
    whenHappened: reviewTargetWithValue(
      deviationReviewTargets.whenHappened,
      deviation.whenHappened,
    ),
    whereHappened: reviewTargetWithValue(
      deviationReviewTargets.whereHappened,
      deviation.whereHappened,
    ),
    howHappened: reviewTargetWithValue(
      deviationReviewTargets.howHappened,
      deviation.howHappened,
    ),
    investigation: reviewTargetWithValue(
      deviationReviewTargets.investigation,
      deviation.investigation,
    ),
    rootCause: reviewTargetWithValue(
      deviationReviewTargets.rootCause,
      deviation.rootCause,
    ),
    recurrenceDetails: reviewTargetWithValue(
      deviationReviewTargets.recurrenceDetails,
      deviation.recurrenceDetails,
    ),
    impactAssessment: reviewTargetWithValue(
      deviationReviewTargets.impactAssessment,
      [
        `Validación: ${triStateLabel(deviation.validationImpact)}`,
        `Registro: ${triStateLabel(deviation.registrationImpact)}`,
        `Estabilidad: ${triStateLabel(deviation.stabilityImpact)}`,
        `Producto terminado: ${triStateLabel(deviation.affectsFinishedProduct)}`,
        `Otros procesos/productos: ${triStateLabel(deviation.otherProcessesImpact)}`,
        `Detalle: ${text(deviation.otherProcessesImpactDetails)}`,
      ],
    ),
    immediateActions: reviewTargetWithValue(
      deviationReviewTargets.immediateActions,
      deviation.immediateActions.map((item) => item.description),
    ),
    capaPlans: reviewTargetWithValue(
      deviationReviewTargets.capaPlans,
      deviation.capaPlans.map((item) => item.description),
    ),
    conclusion: reviewTargetWithValue(
      deviationReviewTargets.conclusion,
      deviation.conclusion,
    ),
    disposition: reviewTargetWithValue(
      deviationReviewTargets.disposition,
      deviation.disposition,
    ),
    dispositionComments: reviewTargetWithValue(
      deviationReviewTargets.dispositionComments,
      deviation.dispositionComments,
    ),
  };
  const immediateActionReviewTargets = deviation.immediateActions.map((item) =>
    deviationImmediateActionReviewTarget(item.id, item.description),
  );
  const capaPlanReviewTargets = deviation.capaPlans.map((item) =>
    deviationCapaPlanReviewTarget(item.id, item.description),
  );
  const reviewTargets = [
    ...Object.values(reviewTarget),
    ...immediateActionReviewTargets,
    ...capaPlanReviewTargets,
  ];
  const immediateActionTargetById = new Map(
    immediateActionReviewTargets.map((target) => [target.targetEntityId!, target]),
  );
  const capaPlanTargetById = new Map(
    capaPlanReviewTargets.map((target) => [target.targetEntityId!, target]),
  );

  return (
    <ReviewWorkspaceProvider
      qmsRecordId={deviation.qmsRecord.id}
      module="DEVIATION"
      basePath={basePath}
      currentVersionLabel={reviewVersionLabel(currentVersion?.sequenceNumber ?? null)}
      defaultActor={currentActor()}
      reviewMode={reviewMode}
      targets={reviewTargets}
      threads={reviewThreads}
      initialThreadId={thread}
    >
    <section className={`workspace${reviewMode ? " review-mode-active" : ""}`}>
      <div className="record-header">
        <div>
          <p className="eyebrow"><Link href={qmsListingReturnTo("/deviations", returnTo)}>← Desviaciones</Link></p>
          <div className="record-title-line">
            <h1>{code}</h1>
            <span className={`badge ${deviation.status === "DRAFT" ? "neutral" : deviation.status === "OPEN" ? "open" : "closed"}`}>{deviation.status === "DRAFT" ? "Borrador" : deviation.status === "OPEN" ? "Abierta" : "Cerrada"}</span>
            {deviation.classification ? <span className={`badge ${deviation.classification.toLowerCase()}`}>{classificationLabel(deviation.classification)}</span> : null}
            <span className="badge neutral">{deviation.departmentCodeSnapshot ?? deviation.department?.code ?? "Sin departamento"}</span>
            {currentVersion ? <span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          <p className="muted-note">Apertura {formatDate(deviation.issueDate)} · Cumplimentado por {text(deviation.createdByText)}</p>
        </div>
        <div className="record-actions">
          <PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath, activeTab, reviewMode), "/deviations", returnTo)} /></PermissionGate>
          <PermissionGate permission="EDIT" form><Link className="button primary" href={qmsWithReturnTo(`/deviations/${id}/edit?tab=${activeTab}`, "/deviations", returnTo)}>{deviation.status === "DRAFT" ? "Editar borrador" : "Editar/nueva versión"}</Link></PermissionGate>
          {deviation.status === "DRAFT"
            ? <span className="muted-note">El Anexo III estará disponible al abrir la desviación.</span>
            : <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button" href={`/api/deviations/${id}/annex-iii`}>Generar Anexo III</a></PermissionGate>}
        </div>
      </div>

      <QmsAdministrativeStatus
        qmsRecordId={deviation.qmsRecord.id}
        isActive={deviation.qmsRecord.isActive}
        code={qmsRecordDisplayCode(deviation.qmsRecord)}
        annulledAt={deviation.qmsRecord.annulledAt?.toISOString() ?? null}
        annulledByText={deviation.qmsRecord.annulledByText}
        annulledReason={deviation.qmsRecord.annulledReason}
        defaultActor={currentActor()}
      />

      <nav className="record-tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={qmsWithReturnTo(reviewTabHref(basePath, key, reviewMode), "/deviations", returnTo)}>
            {key === "review" ? `${label} (${reviewActiveCount})` : label}
          </Link>
        ))}
      </nav>

      {activeTab === "summary" ? (
        <>
          <div className="card deviation-summary-card">
            <h2>Resumen del expediente</h2>
            <dl className="info-grid compact-info-grid">
              <div id={reviewTarget.materialProcessAffected.anchorId} className="info-item review-target"><dt><span>Material / proceso</span><ReviewMarker target={reviewTarget.materialProcessAffected} /></dt><dd>{text(deviation.materialProcessAffected)}</dd></div>
              <div id={reviewTarget.classification.anchorId} className="info-item review-target"><dt><span>Clasificación</span><ReviewMarker target={reviewTarget.classification} /></dt><dd>{classificationLabel(deviation.classification)}</dd></div>
              <div className="info-item"><dt>En plazo</dt><dd>{deadlineLabel(deviation.deadlineStatus)}</dd></div>
              <div className="info-item"><dt>Fecha de cierre</dt><dd>{formatDate(deviation.closedAt)}</dd></div>
              <div className="info-item"><dt>Medidas adoptadas</dt><dd>{measuresLabel(deviation)}</dd></div>
              <div className="info-item"><dt>Documento firmado</dt><dd>{currentVersion ? `${versionLabel(currentVersion.sequenceNumber)} · ${currentSignedDocument ? "Disponible" : "No cargado"}` : "Sin versión"}</dd></div>
              <div className="info-item"><dt>Calidad del dato</dt><dd>{dataQualityLabel(deviation.dataQualityStatus)}</dd></div>
              <div className="info-item full"><dt>Observaciones internas</dt><dd className="prose-value">{text(deviation.internalObservations)}</dd></div>
            </dl>
          </div>

          {originDetails.length || reviewMode ? (
            <div id={reviewTarget.origin.anchorId} className="card origin-card review-target">
              <div className="section-title-row">
                <div>
                  <div className="review-target-heading"><h2>Origen</h2><ReviewMarker target={reviewTarget.origin} /></div>
                  <p className="section-help">Apartado A del Anexo III · se muestran únicamente los datos informados.</p>
                </div>
              </div>
              <dl className="origin-detail-grid">
                {originDetails.map((item) => (
                  <div className="info-item" key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="card related-capa-summary">
            <AuditOriginPanel targetRecordId={deviation.qmsRecordId}/><OosOriginPanel targetRecordId={deviation.qmsRecordId}/><h2>CAPA relacionadas</h2>
            <p className="section-help">
              Acciones CAPA propuestas o registradas a partir de esta desviación.
            </p>
            {deviation.capaPlans.length ? (
              <div className="table-scroll">
                <table className="action-overview-table summary-capa-table">
                  <thead>
                    <tr>
                      <th>Código CAPA</th>
                      <th>Descripción CAPA</th>
                      <th>Fecha prevista</th>
                      <th>Responsable</th>
                      <th>Estado</th>
                      <th aria-label="Acción" />
                    </tr>
                  </thead>
                  <tbody>
                    {deviation.capaPlans.map((plan) => {
                      const navigation = capaPlanNavigation(plan);
                      const capaCode =
                        plan.businessCapaCode ??
                        plan.linkedCapaRecord?.businessCode ??
                        (plan.proposalStatus === "PROPOSED" ? "Pendiente" : "—");
                      return (
                        <tr key={plan.id}>
                          <td>
                            {navigation.kind === "OPEN" ? (
                              <Link className="summary-link" href={qmsRecordHref("CAPA", navigation.recordId)}>{capaCode}</Link>
                            ) : capaCode}
                          </td>
                          <td className="action-description-cell">{plan.description}</td>
                          <td>{formatDate(plan.plannedExecutionDate)}</td>
                          <td>{text(plan.responsible)}<ResponsibleUserNote user={plan.responsibleUser} /></td>
                          <td><span className="badge neutral">{capaProposalStatusLabel(plan.proposalStatus)}</span></td>
                          <td className="action-link-cell">
                            {navigation.kind === "OPEN" ? (
                              <Link className="button small" href={qmsRecordHref("CAPA", navigation.recordId)}>Abrir CAPA</Link>
                            ) : navigation.kind === "CREATE" ? (
                              <PermissionGate permission="EDIT"><PermissionGate permission="CREATE" module="CAPA"><Link className="button small primary" href={`/capa/new?fromDeviationPlanId=${plan.id}`}>Crear CAPA</Link></PermissionGate></PermissionGate>
                            ) : (
                              <span className="muted-note">{plan.proposalStatus === "CANCELLED" ? "Cancelada" : "Sin vínculo"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-panel">No hay CAPA propuestas.</div>}
          </div>
        </>
      ) : null}

      {activeTab === "description" ? (
        <div className="card">
          <div className="section-title-row">
            <div>
              <h2>Descripción del evento</h2>
              <p className="section-help">Apartado C del Anexo III · hechos observables del evento.</p>
            </div>
          </div>
          <dl className="description-detail-grid">
            <div id={reviewTarget.whatHappened.anchorId} className="info-item full review-target"><dt><span>Qué sucedió / qué debía haber sucedido</span><ReviewMarker target={reviewTarget.whatHappened} /></dt><dd className="prose-value">{text(deviation.whatHappened)}</dd></div>
            {deviation.whoInvolved || reviewMode ? <div id={reviewTarget.whoInvolved.anchorId} className="info-item review-target"><dt><span>Quién estuvo implicado</span><ReviewMarker target={reviewTarget.whoInvolved} /></dt><dd className="prose-value">{text(deviation.whoInvolved)}</dd></div> : null}
            {deviation.whenHappened || reviewMode ? <div id={reviewTarget.whenHappened.anchorId} className="info-item review-target"><dt><span>Cuándo ocurrió</span><ReviewMarker target={reviewTarget.whenHappened} /></dt><dd className="prose-value">{text(deviation.whenHappened)}</dd></div> : null}
            {deviation.whereHappened || reviewMode ? <div id={reviewTarget.whereHappened.anchorId} className="info-item review-target"><dt><span>Dónde ocurrió</span><ReviewMarker target={reviewTarget.whereHappened} /></dt><dd className="prose-value">{text(deviation.whereHappened)}</dd></div> : null}
            {deviation.howHappened || reviewMode ? <div id={reviewTarget.howHappened.anchorId} className="info-item review-target"><dt><span>Cómo ocurrió / cómo se detectó</span><ReviewMarker target={reviewTarget.howHappened} /></dt><dd className="prose-value">{text(deviation.howHappened)}</dd></div> : null}
          </dl>
        </div>
      ) : null}

      {activeTab === "investigation" ? (
        <>
          <div className="card">
            <h2>Investigación</h2>
            <dl className="info-grid compact-info-grid">
              <div id={reviewTarget.investigation.anchorId} className="info-item full review-target"><dt><span>Investigación realizada</span><ReviewMarker target={reviewTarget.investigation} /></dt><dd className="prose-value">{text(deviation.investigation)}</dd></div>
              <div className="info-item"><dt>Resultado</dt><dd>{investigationResultLabel(deviation.investigationConclusive)}</dd></div>
            </dl>
          </div>
          <div className="card root-cause-card">
            <h2>Causa raíz</h2>
            <dl className="info-grid compact-info-grid">
              <div id={reviewTarget.rootCause.anchorId} className="info-item full review-target"><dt><span>Causa raíz establecida</span><ReviewMarker target={reviewTarget.rootCause} /></dt><dd className="prose-value">{text(deviation.rootCause)}</dd></div>
              <div className="info-item"><dt>Categoría (6M)</dt><dd>{deviation.rootCauseCategories.length ? deviation.rootCauseCategories.map((value) => rootCauseCategoryLabel(value, true)).join(", ") : "No informada"}</dd></div>
              <div className="info-item"><dt>Metodología</dt><dd>{deviation.investigationMethods.length ? deviation.investigationMethods.map(investigationMethodLabel).join(", ") : "No informada"}</dd></div>
              <div className="info-item"><dt>Recurrencia</dt><dd>{triStateLabel(deviation.recurrentRootCause)}</dd></div>
              <div className="info-item full"><SimilarDeviations items={similarDeviations} /></div>
              <div id={reviewTarget.recurrenceDetails.anchorId} className="info-item wide review-target"><dt><span>Antecedentes / detalle</span><ReviewMarker target={reviewTarget.recurrenceDetails} /></dt><dd className="prose-value">{text(deviation.recurrenceDetails)}</dd></div>
            </dl>
          </div>
          <div id={reviewTarget.impactAssessment.anchorId} className="card review-target">
            <div className="review-target-heading"><h2>Evaluación de impacto</h2><ReviewMarker target={reviewTarget.impactAssessment} /></div>
            <dl className="info-grid">
              <div className="info-item"><dt>Validación</dt><dd>{triStateLabel(deviation.validationImpact)}</dd></div>
              <div className="info-item"><dt>Registro</dt><dd>{triStateLabel(deviation.registrationImpact)}</dd></div>
              <div className="info-item"><dt>Estabilidad</dt><dd>{triStateLabel(deviation.stabilityImpact)}</dd></div>
              <div className="info-item"><dt>Producto terminado</dt><dd>{triStateLabel(deviation.affectsFinishedProduct)}</dd></div>
              <div className="info-item"><dt>Otros procesos/productos</dt><dd>{triStateLabel(deviation.otherProcessesImpact)}</dd></div>
              <div className="info-item wide"><dt>Detalle</dt><dd className="prose-value">{text(deviation.otherProcessesImpactDetails)}</dd></div>
            </dl>
          </div>
        </>
      ) : null}

      {activeTab === "actions" ? (
        <>
          <div id={reviewTarget.immediateActions.anchorId} className="card review-target">
            <div className="review-target-heading"><h2>Acciones inmediatas</h2><ReviewMarker target={reviewTarget.immediateActions} /></div>
            {deviation.immediateActions.length ? (
              <div className="table-scroll">
                <table className="action-overview-table immediate-action-table">
                  <thead>
                    <tr>
                      <th aria-label="Número">N.º</th>
                      <th>Descripción</th>
                      <th>Ejecutada por</th>
                      <th>Fecha de ejecución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviation.immediateActions.map((action, index) => {
                      const target = immediateActionTargetById.get(action.id)!;
                      return (
                        <tr id={target.anchorId} className="review-target" key={action.id}>
                          <td className="action-number-cell">{String(index + 1).padStart(2, "0")}</td>
                          <td className="action-description-cell"><span>{action.description}</span><ReviewMarker target={target} /></td>
                          <td>{text(action.executedBy)}<ResponsibleUserNote user={action.executedByUser} /></td>
                          <td>{formatDate(action.executedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-panel">No se han registrado acciones inmediatas.</div>}
          </div>
          <div id={reviewTarget.capaPlans.anchorId} className="card review-target">
            <div className="review-target-heading"><h2>CAPA propuestas</h2><ReviewMarker target={reviewTarget.capaPlans} /></div>
            {deviation.capaPlans.length ? (
              <div className="table-scroll">
                <table className="action-overview-table capa-action-table">
                  <thead>
                    <tr>
                      <th aria-label="Número">N.º</th>
                      <th>Código CAPA</th>
                      <th>Descripción CAPA</th>
                      <th>Fecha prevista</th>
                      <th>Responsable</th>
                      <th>Estado</th>
                      <th aria-label="Acción" />
                    </tr>
                  </thead>
                  <tbody>
                    {deviation.capaPlans.map((plan, index) => {
                      const navigation = capaPlanNavigation(plan);
                      const target = capaPlanTargetById.get(plan.id)!;
                      const capaCode =
                        plan.businessCapaCode ??
                        plan.linkedCapaRecord?.businessCode ??
                        (plan.proposalStatus === "PROPOSED" ? "Pendiente" : "—");
                      return (
                        <tr id={target.anchorId} className="review-target" key={plan.id}>
                          <td className="action-number-cell">{String(index + 1).padStart(2, "0")}</td>
                          <td>
                            {navigation.kind === "OPEN" ? (
                              <Link className="summary-link" href={qmsRecordHref("CAPA", navigation.recordId)}>{capaCode}</Link>
                            ) : capaCode}
                          </td>
                          <td className="action-description-cell"><span>{plan.description}</span><ReviewMarker target={target} /></td>
                          <td>{formatDate(plan.plannedExecutionDate)}</td>
                          <td>{text(plan.responsible)}<ResponsibleUserNote user={plan.responsibleUser} /></td>
                          <td>{capaProposalStatusLabel(plan.proposalStatus)}</td>
                          <td className="action-link-cell">
                            {navigation.kind === "OPEN" ? (
                              <Link className="button small" href={qmsRecordHref("CAPA", navigation.recordId)}>Abrir CAPA</Link>
                            ) : navigation.kind === "CREATE" ? (
                              <PermissionGate permission="EDIT"><PermissionGate permission="CREATE" module="CAPA"><Link className="button small primary" href={`/capa/new?fromDeviationPlanId=${plan.id}`}>Crear CAPA</Link></PermissionGate></PermissionGate>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-panel">No se han definido CAPA.</div>}
          </div>
        </>
      ) : null}

      {activeTab === "conclusion" ? (
        <div className="card">
          <h2>Conclusión y disposición</h2>
          <dl className="info-grid conclusion-grid">
            <div id={reviewTarget.conclusion.anchorId} className="info-item full review-target"><dt><span>Conclusión / cierre</span><ReviewMarker target={reviewTarget.conclusion} /></dt><dd className="prose-value">{text(deviation.conclusion)}</dd></div>
            <div id={reviewTarget.disposition.anchorId} className="info-item review-target"><dt><span>Disposición</span><ReviewMarker target={reviewTarget.disposition} /></dt><dd>{text(deviation.disposition)}</dd></div>
            <div className="info-item"><dt>Cantidad</dt><dd>{text(deviation.dispositionQuantity)}</dd></div>
            <div className="info-item"><dt>Notificación al cliente</dt><dd>{triStateLabel(deviation.clientNotification)}</dd></div>
            <div className="info-item"><dt>Fecha de cierre</dt><dd>{formatDate(deviation.closedAt)}</dd></div>
            <div id={reviewTarget.dispositionComments.anchorId} className="info-item full review-target"><dt><span>Comentarios de disposición</span><ReviewMarker target={reviewTarget.dispositionComments} /></dt><dd className="prose-value">{text(deviation.dispositionComments)}</dd></div>
          </dl>
        </div>
      ) : null}

      {activeTab === "relations" ? (
        <div className="card">
          <AuditOriginPanel targetRecordId={deviation.qmsRecordId}/><OosOriginPanel targetRecordId={deviation.qmsRecordId}/><h2>CAPA relacionadas</h2>
          <p className="section-help">
            Una desviación puede generar una o varias CAPA. La relación se almacena una sola vez como Desviación → CAPA.
          </p>
          {relatedCapas.length ? (
            <div className="relation-list">
              {relatedCapas.map((record) => (
                <div className="relation-card" key={record.id}>
                  <span>Genera CAPA</span>
                  <Link href={qmsRecordHref(record.recordType, record.id)}>
                    <strong>{record.businessCode ?? "CAPA"}</strong>
                  </Link>
                  <small>CAPA</small>
                  <PermissionGate permission="EDIT" recordId={record.id}><form action={unlinkDeviationCapaAction.bind(null, id, record.id)}><CsrfField />
                    <ActorField type="hidden" name="actor" value={deviation.createdByText ?? currentActor()} />
                    <button className="button danger small" type="submit">Desvincular</button>
                  </form></PermissionGate>
                </div>
              ))}
            </div>
          ) : <div className="empty-panel">Esta desviación todavía no tiene CAPA vinculadas.</div>}
          <PermissionGate permission="EDIT"><OperationalRelationForm
            action={addDeviationRelationAction.bind(null, id)}
            title="Vincular CAPA existente"
            codeLabel="Codificación CAPA"
            codePlaceholder="AC/GC-00/001/2026"
            buttonLabel="Vincular CAPA"
            defaultActor={currentActor()}
            targetOptions={[{ value: "CAPA", label: "CAPA" }]}
            currentRecordId={deviation.qmsRecord.id}
            currentRecordType="DEVIATION"
          /></PermissionGate>
        </div>
      ) : null}

      {activeTab === "versions" ? (
        <div className="card">
          <div className="section-title-row version-section-title-row">
            <div className="section-title-copy">
              <h2>Versiones del expediente</h2>
              <p className="muted-note version-section-help">
                Guardar cambios mantiene la versión vigente. Crear una nueva versión conserva la versión anterior como histórica y genera la siguiente versión del expediente.
              </p>
            </div>
            {currentVersion ? <span className="badge neutral">Actual {versionLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          {deviation.qmsRecord.versions.length ? (
            <div className="timeline">
              {[...deviation.qmsRecord.versions].reverse().map((item) => {
                const summary = recordVersionSummary("DEVIATION", item.snapshot);
                const kind =
                  item.sequenceNumber === 0
                    ? "Versión inicial"
                    : item.kind === "REOPENING"
                      ? "Reapertura"
                      : item.kind === "HISTORICAL_STATE"
                        ? "Estado histórico"
                        : "Versión";
                return (
                  <article className="timeline-item record-version-item" key={item.id}>
                    <header className="record-version-header">
                      <strong>{versionLabel(item.sequenceNumber)} · {kind}</strong>
                      <span className={`badge ${summary.status === "DRAFT" ? "neutral" : summary.status === "OPEN" ? "open" : "closed"}`}>
                        {summary.status === "DRAFT" ? "Borrador" : summary.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </span>
                      {item.frozenAt ? <span className="badge neutral">Histórica</span> : <span className="badge neutral">Vigente</span>}
                    </header>
                    <div className="record-version-details">
                      <div className="record-version-detail">
                        <span>Fecha de cierre de esta versión</span>
                        <strong>{formatDate(summary.closedAt)}</strong>
                      </div>
                      <div className="record-version-detail">
                        <span>Motivo de esta versión</span>
                        <strong>{item.reason ?? "—"}</strong>
                      </div>
                      <div className="record-version-detail">
                        <span>Registrada</span>
                        <strong>{formatDate(item.createdAt)} · {item.createdByText ?? "Sistema"}</strong>
                      </div>
                    </div>
                    {(() => {
                      const signedDocument = item.documents.find((document) => document.kind === "SIGNED_PDF") ?? null;
                      return (
                        <>
                          <div className="document-actions">
                            <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={`/api/deviations/${id}/annex-iii?version=${item.sequenceNumber}`}>
                              Descargar Anexo III {versionLabel(item.sequenceNumber)}
                            </a></PermissionGate>
                            {signedDocument ? (
                              <PermissionGate permission="DOWNLOAD"><a
                                className="button small"
                                href={`/api/deviations/${id}/versions/${item.sequenceNumber}/signed-pdf`}
                              >
                                Descargar PDF firmado {versionLabel(item.sequenceNumber)}
                              </a></PermissionGate>
                            ) : null}
                          </div>
                          <div className="version-signed-document">
                            <strong>PDF firmado: {signedDocument ? "Disponible" : "No cargado"}</strong>
                            {signedDocument ? (
                              <small className="muted-note">
                                {signedDocument.fileName} · {Math.max(1, Math.round(signedDocument.fileSize / 1024))} KB · cargado {formatDate(signedDocument.uploadedAt)} · {signedDocument.uploadedByText ?? "Usuario no informado"}
                              </small>
                            ) : (
                              <small className="muted-note">
                                Carga aquí el documento firmado correspondiente exclusivamente a {versionLabel(item.sequenceNumber)}.
                              </small>
                            )}
                            <PermissionGate permission="ATTACH_DOCUMENT"><SignedVersionDocumentForm
                              action={uploadDeviationSignedPdfAction.bind(null, id, item.id)}
                              defaultActor={currentActor()}
                              replace={Boolean(signedDocument)}
                            /></PermissionGate>
                          </div>
                        </>
                      );
                    })()}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel">
              Este expediente todavía no tiene snapshot de versión. Se creará al editarlo o versionarlo con Hito 6.1.
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <div className="card documents-card">
          <h2>Documentos</h2>
          <dl className="info-grid documents-info-grid">
            <div className="info-item"><dt>Versión formulario</dt><dd>{deviation.formVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item"><dt>Plantilla Anexo III</dt><dd>{deviation.anexoIIITemplateVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item"><dt>Documento firmado de la versión vigente</dt><dd>{currentVersion ? `${versionLabel(currentVersion.sequenceNumber)} · ${currentSignedDocument ? "Disponible" : "No cargado"}` : "Sin versión"}</dd></div>
          </dl>
          <div className="document-grid">
            <div className="document-block">
              <h3>Anexo III · Informe de desviación</h3>
              <p>Plantilla oficial asociada al expediente y documento Word cumplimentado con los datos vigentes.</p>
              <div className="document-actions">
                {deviation.anexoIIITemplateVersion?.id ? <PermissionGate permission="DOWNLOAD" module="DEVIATION"><a className="button" href={`/api/settings/templates/${deviation.anexoIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a></PermissionGate> : <span className="muted-note">Plantilla oficial pendiente de cargar.</span>}
                <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button primary" href={`/api/deviations/${id}/annex-iii`}>Generar Anexo III cumplimentado</a></PermissionGate>
              </div>
            </div>
            <div className="document-block">
              <h3>Anexo V · Listado de desviaciones</h3>
              <p>Listado oficial anual. Se genera desde la pantalla principal de Desviaciones para el año seleccionado.</p>
              <Link className="button" href="/deviations">Ir al listado y descargar Anexo V</Link>
            </div>
          </div>
          {deviation.qmsRecord.generatedDocuments.length ? (
            <>
              <h3>Generaciones registradas</h3>
              <div className="timeline">
                {deviation.qmsRecord.generatedDocuments.map((document) => (
                  <div className="timeline-item document-generation-item" key={document.id}>
                    <strong className="document-generation-type">{document.documentType}</strong>
                    <small className="muted-note document-generation-meta">
                      Generado {formatDate(document.generatedAt)} · {document.generatedByText ?? "Usuario no informado"}
                    </small>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === "review" ? (
        <div className="review-overview">
          <div className="card">
            <div className="section-title-row">
              <div>
                <h2>Revisión del expediente</h2>
                <p className="muted-note">Observaciones vinculadas a objetivos estables y a la versión del expediente revisada cuando exista.</p>
              </div>
              <PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath, "review", reviewMode), "/deviations", returnTo)} /></PermissionGate>
            </div>
            <ReviewStatusSummary />
          </div>
          <ReviewThreadList />
        </div>
      ) : null}

      {activeTab === "evidence" ? <RecordEvidencePanel qmsRecordId={deviation.qmsRecord.id} active={deviation.qmsRecord.isActive} action={uploadDeviationEvidenceAction.bind(null, id)} /> : null}
      {activeTab === "timeline" ? <RecordTimeline qmsRecordId={deviation.qmsRecord.id} /> : null}
      {activeTab === "audit-trail" ? <AuditTrailPanel rootKey={`QMS_RECORD:${deviation.qmsRecord.id}`} basePath={basePath} page={Number(auditPage)||1}/> : null}
    </section>
    <ReviewDrawer />
    </ReviewWorkspaceProvider>
  );
}

export default async function DeviationDetailPage(...args: Parameters<typeof DeviationDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/deviations/[id]/page.tsx", () => DeviationDetailPageAuthenticatedContent(...args), args);
}
