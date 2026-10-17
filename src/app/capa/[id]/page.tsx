import { rootCauseCategoryLabel } from "@/lib/qms/root-cause-categories";
import { RecordTimeline } from "@/components/record-timeline";
import { ActorField } from "@/components/permissions";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { AuditTrailPanel } from "@/components/audit-trail-panel";

import { CsrfField } from "@/components/csrf";
import { authorizedPage } from "@/lib/auth/page-guard";
import { AuditOriginPanel } from "@/modules/audits/origin-panel";
import Link from "next/link";
import { qmsListingReturnTo, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { notFound } from "next/navigation";
import { addCapaRelationAction, unlinkCapaOriginAction } from "@/modules/capa/actions";
import {
  capaStatusLabel,
  capaTypeLabel,
  effectivenessLabel,
  formatDate,
} from "@/modules/capa/domain";
import { getCapaDetail } from "@/modules/capa/queries";
import { capaSnapshotVersionFollowupDate, recordVersionSummary } from "@/lib/qms/versioning";
import { qmsRecordHref, qmsRecordTypeLabel, qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { OperationalRelationForm } from "@/components/operational-relation-form";
import { OosOriginPanel } from "@/modules/oos/origin-panel";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { SignedVersionDocumentForm } from "@/components/signed-version-document-form";
import { uploadCapaSignedPdfAction } from "@/modules/capa/signed-document-actions";
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
} from "@/lib/qms/review/ui-model";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import {
  capaActionFollowupReviewTarget,
  capaPlannedActionReviewTarget,
  capaReviewTargets,
} from "@/lib/qms/review/targets/capa";

export const dynamic = "force-dynamic";

const tabs = [
  ["summary", "Resumen"],
  ["action-followups", "Seguimiento de la acción"],
  ["state", "Estado y eficacia"],
  ["relations", "Relaciones"],
  ["versions", "Seguimientos"],
  ["documents", "Documentos"],
  ["review", "Revisión"],
  ["timeline", "Cronología"],
  ["audit-trail", "Audit Trail"],
] as const;

function originRelationLabel(recordType: string) {
  if (recordType === "DEVIATION") return "Desviación de origen";
  if (recordType === "COMPLAINT") return "Reclamación de origen";
  if (recordType === "AUDIT") return "Auditoría de origen";
  return "Expediente de origen";
}

function followupLabel(sequenceNumber: number) {
  return sequenceNumber === 0
    ? "Seguimiento 00 · Apertura"
    : `Seguimiento ${String(sequenceNumber).padStart(2, "0")}`;
}

async function CapaDetailPageAuthenticatedContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; review?: string; thread?: string; returnTo?: string; auditPage?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, review, thread, returnTo, auditPage } = await searchParams;
  const activeTab = tabs.some(([key]) => key === rawTab) ? rawTab! : "summary";
  const capa = await getCapaDetail(id);
  if (!capa) notFound();

  const currentVersion = capa.qmsRecord.versions.at(-1) ?? null;
  const reviewMode = review === "1";
  const basePath = `/capa/${id}`;
  const reviewThreads = await getReviewThreadsForDisplay(capa.qmsRecord.id);
  const reviewActiveCount = activeReviewCount({
    PENDING: reviewThreads.filter((item) => item.status === "PENDING").length,
    ACCEPTED: reviewThreads.filter((item) => item.status === "ACCEPTED").length,
  });
  const signedFollowupNumbers = capa.qmsRecord.versions
    .filter((version) => version.documents.some((document) => document.kind === "SIGNED_PDF"))
    .map((version) => version.sequenceNumber);
  const origins = capa.qmsRecord.targetRelations
    .filter(
      (item) =>
        item.relationType === "GENERATES" &&
        (item.sourceRecord.recordType === "DEVIATION" ||
          item.sourceRecord.recordType === "COMPLAINT" || item.sourceRecord.recordType === "AUDIT"),
    )
    .map((item) => item.sourceRecord);
  const hasOosOrigin = capa.qmsRecord.targetRelations.some((item) => item.relationType === "GENERATES" && item.sourceRecord.recordType === "OOS");

  const reviewTarget = {
    actionType: reviewTargetWithValue(
      capaReviewTargets.actionType,
      capaTypeLabel(capa.actionType),
    ),
    applicableTo: reviewTargetWithValue(
      capaReviewTargets.applicableTo,
      capa.applicableTo,
    ),
    defectDescription: reviewTargetWithValue(
      capaReviewTargets.defectDescription,
      capa.defectDescription,
    ),
    rootCause: reviewTargetWithValue(
      capaReviewTargets.rootCause,
      capa.rootCause,
    ),
    impactAssessment: reviewTargetWithValue(
      capaReviewTargets.impactAssessment,
      capa.impactAssessment,
    ),
    internalObservations: reviewTargetWithValue(
      capaReviewTargets.internalObservations,
      capa.internalObservations,
    ),
    origin: reviewTargetWithValue(
      capaReviewTargets.origin,
      origins.map((record) =>
        qmsRecordDisplayCode(record, qmsRecordTypeLabel(record.recordType)),
      ),
    ),
    plannedActions: reviewTargetWithValue(
      capaReviewTargets.plannedActions,
      capa.plannedActions.map((item) => item.description),
    ),
    actionFollowups: reviewTargetWithValue(
      capaReviewTargets.actionFollowups,
      capa.actionFollowups.map((item) => item.description ?? "—"),
    ),
    actionFollowupObservations: reviewTargetWithValue(
      capaReviewTargets.actionFollowupObservations,
      capa.actionFollowupObservations,
    ),
    operationalState: reviewTargetWithValue(
      capaReviewTargets.operationalState,
      {
        status: capaStatusLabel(capa.status),
        closedAt: formatDate(capa.operationalClosedAt),
        description:
          capa.operationalStatusDescription ?? capa.cancellationReason ?? "—",
      },
    ),
    effectivenessAssessment: reviewTargetWithValue(
      capaReviewTargets.effectivenessAssessment,
      capa.effectivenessAssessment,
    ),
    conclusion: reviewTargetWithValue(
      capaReviewTargets.conclusion,
      capa.conclusion,
    ),
  };
  const plannedActionReviewTargets = capa.plannedActions.map((item) =>
    capaPlannedActionReviewTarget(item.id, {
      description: item.description,
      responsible: item.responsible ?? "—",
      plannedExecutionDate: formatDate(item.plannedExecutionDate),
      impact: item.impact ?? "—",
    }),
  );
  const actionFollowupReviewTargets = capa.actionFollowups.map((item) =>
    capaActionFollowupReviewTarget(item.id, {
      followupDate: formatDate(item.followupDate),
      description: item.description ?? "—",
    }),
  );
  const reviewTargets = [
    ...Object.values(reviewTarget),
    ...plannedActionReviewTargets,
    ...actionFollowupReviewTargets,
  ];
  const plannedActionTargetById = new Map(
    plannedActionReviewTargets.map((target) => [target.targetEntityId!, target]),
  );
  const actionFollowupTargetById = new Map(
    actionFollowupReviewTargets.map((target) => [target.targetEntityId!, target]),
  );

  return (
    <ReviewWorkspaceProvider
      qmsRecordId={capa.qmsRecord.id}
      module="CAPA"
      basePath={basePath}
      currentVersionLabel={
        currentVersion ? followupLabel(currentVersion.sequenceNumber) : "Sin versión"
      }
      versionLabelMode="FOLLOWUP"
      defaultActor={currentActor()}
      reviewMode={reviewMode}
      targets={reviewTargets}
      threads={reviewThreads}
      initialThreadId={thread}
    >
    <section className={`workspace${reviewMode ? " review-mode-active" : ""}`}>
      <div className="record-header">
        <div>
          <p className="eyebrow"><Link href={qmsListingReturnTo("/capa", returnTo)}>← CAPA</Link></p>
          <div className="record-title-line">
            <h1>{qmsRecordDisplayCode(capa.qmsRecord, "CAPA sin código")}</h1>
            <span className="badge neutral">{capaTypeLabel(capa.actionType)}</span>
            <span className={`badge ${capa.status === "OPEN" ? "open" : capa.status === "CLOSED" ? "closed" : "neutral"}`}>
              {capaStatusLabel(capa.status)}
            </span>
            <span className="badge neutral">{capa.departmentCodeSnapshot ?? "Sin departamento"}</span>
            {currentVersion ? <span className="badge neutral">{followupLabel(currentVersion.sequenceNumber)}</span> : null}
            {capa.dataQualityStatus !== "COMPLETE" ? (
              <span className="badge warning">
                {capa.dataQualityStatus === "INCOMPLETE" ? "Dato incompleto" : "Revisar dato"}
              </span>
            ) : null}
          </div>
          <p className="muted-note">
            Apertura {formatDate(capa.openedAt)} · Eficacia {effectivenessLabel(capa.effectivenessStatus)}
          </p>
        </div>
        <div className="record-actions">
          <PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath, activeTab, reviewMode), "/capa", returnTo)} /></PermissionGate>
          <PermissionGate permission="EDIT" form><Link className="button primary" href={qmsWithReturnTo(`/capa/${id}/edit?tab=${activeTab}`, "/capa", returnTo)}>Editar / nuevo seguimiento</Link></PermissionGate>
          {capa.status !== "DRAFT" ? <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button" href={`/api/capa/${id}/annex-iii`}>Generar Anexo III</a></PermissionGate> : null}
        </div>
      </div>

      {capa.status === "DRAFT" ? (
        <div className="analytics-note">
          <strong>Borrador:</strong> este expediente todavía no es una CAPA operativa. Completa los campos obligatorios y pulsa Guardar CAPA para iniciar su ciclo operativo.
        </div>
      ) : null}

      <QmsAdministrativeStatus
        qmsRecordId={capa.qmsRecord.id}
        isActive={capa.qmsRecord.isActive}
        code={qmsRecordDisplayCode(capa.qmsRecord)}
        annulledAt={capa.qmsRecord.annulledAt?.toISOString() ?? null}
        annulledByText={capa.qmsRecord.annulledByText}
        annulledReason={capa.qmsRecord.annulledReason}
        defaultActor={currentActor()}
      />

      <nav className="record-tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={qmsWithReturnTo(reviewTabHref(basePath, key, reviewMode), "/capa", returnTo)}>
            {key === "review" ? `${label} (${reviewActiveCount})` : label}
          </Link>
        ))}
      </nav>

      {activeTab === "summary" ? (
        <>
          <div className="card">
            <h2>Resumen del expediente</h2>
            <dl className="info-grid">
              <div id={reviewTarget.actionType.anchorId} className="info-item review-target"><dt><span>Tipo CAPA</span><ReviewMarker target={reviewTarget.actionType} /></dt><dd>{capaTypeLabel(capa.actionType)}</dd></div>
              <div className="info-item"><dt>Departamento</dt><dd>{capa.departmentCodeSnapshot ?? "—"} · {capa.departmentNameSnapshot ?? ""}</dd></div>
              <div id={reviewTarget.applicableTo.anchorId} className="info-item full review-target"><dt><span>Materia / material / producto / sistema / equipo</span><ReviewMarker target={reviewTarget.applicableTo} /></dt><dd>{capa.applicableTo ?? "—"}</dd></div>
              <div id={reviewTarget.defectDescription.anchorId} className="info-item full review-target"><dt><span>Descripción breve del defecto</span><ReviewMarker target={reviewTarget.defectDescription} /></dt><dd className="prose-value">{capa.defectDescription ?? "—"}</dd></div>
              <div id={reviewTarget.rootCause.anchorId} className="info-item full review-target"><dt><span>Causa raíz</span><ReviewMarker target={reviewTarget.rootCause} /></dt><dd className="prose-value">{capa.rootCause ?? "—"}</dd></div>
              <div className="info-item full"><dt>Categoría de causa raíz (6M)</dt><dd>{capa.rootCauseCategories.length ? capa.rootCauseCategories.map((value) => rootCauseCategoryLabel(value, true)).join(", ") : "No informada"}</dd></div>
              {capa.impactAssessment || reviewMode ? <div id={reviewTarget.impactAssessment.anchorId} className="info-item full review-target"><dt><span>Evaluación de impacto</span><ReviewMarker target={reviewTarget.impactAssessment} /></dt><dd className="prose-value">{capa.impactAssessment ?? "—"}</dd></div> : null}
              <div id={reviewTarget.internalObservations.anchorId} className="info-item full review-target"><dt><span>Observaciones internas</span><ReviewMarker target={reviewTarget.internalObservations} /></dt><dd className="prose-value">{capa.internalObservations ?? "—"}</dd></div>
            </dl>
          </div>

          <div id={reviewTarget.origin.anchorId} className="card review-target">
            <div className="review-target-heading"><h2>Expediente / origen</h2><ReviewMarker target={reviewTarget.origin} /></div>
            {origins.length ? (
              <div className="relation-list">
                {origins.map((record) => (
                  <div className="relation-card" key={record.id}>
                    <span>{originRelationLabel(record.recordType)}</span>
                    <Link href={qmsRecordHref(record.recordType, record.id)}>
                      <strong>{qmsRecordDisplayCode(record, qmsRecordTypeLabel(record.recordType))}{!record.isActive ? " · Anulado" : ""}</strong>
                    </Link>
                    <small>El código abre el expediente de origen.</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel">
                {capa.status === "DRAFT"
                  ? "Los orígenes seleccionados en borrador se activarán al abrir la CAPA."
                  : "No hay un expediente de origen vinculado."}
              </div>
            )}
          </div>

          <div id={reviewTarget.plannedActions.anchorId} className="card review-target">
            <div className="review-target-heading"><h2>Acciones propuestas</h2><ReviewMarker target={reviewTarget.plannedActions} /></div>
            {capa.plannedActions.length ? (
              <div className="table-scroll">
                <table className="records-table compact-table">
                  <thead>
                    <tr><th>#</th><th>Descripción</th><th>Responsable</th><th>Fecha prevista</th><th>Impacto</th></tr>
                  </thead>
                  <tbody>
                    {capa.plannedActions.map((item, index) => {
                      const target = plannedActionTargetById.get(item.id)!;
                      return (
                        <tr id={target.anchorId} className="review-target" key={item.id}>
                          <td>{String(index + 1).padStart(2, "0")}</td>
                          <td className="table-cell-wrap"><span>{item.description}</span><ReviewMarker target={target} /></td>
                          <td>{item.responsible ?? "—"}</td>
                          <td>{formatDate(item.plannedExecutionDate)}</td>
                          <td className="table-cell-wrap">{item.impact ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-panel">No hay acciones propuestas registradas.</div>}
          </div>
        </>
      ) : null}

      {activeTab === "action-followups" ? (
        <div id={reviewTarget.actionFollowups.anchorId} className="card review-target">
          <div className="section-title-row">
            <div>
              <div className="review-target-heading"><h2>Seguimiento de la acción</h2><ReviewMarker target={reviewTarget.actionFollowups} /></div>
              <p className="muted-note">Contenido operativo de la CAPA. Estas filas no son Seguimientos 00/01/02 del expediente.</p>
            </div>
          </div>
          {capa.actionFollowups.length ? (
            <div className="table-scroll">
              <table className="records-table compact-table">
                <thead><tr><th>#</th><th>Fecha</th><th>Descripción</th></tr></thead>
                <tbody>
                  {capa.actionFollowups.map((item, index) => {
                    const target = actionFollowupTargetById.get(item.id)!;
                    return (
                      <tr id={target.anchorId} className="review-target" key={item.id}>
                        <td>{String(index + 1).padStart(2, "0")}</td>
                        <td>{formatDate(item.followupDate)}</td>
                        <td className="table-cell-wrap"><span>{item.description ?? "—"}</span><ReviewMarker target={target} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-panel">No hay seguimientos de acción registrados.</div>}
          {capa.actionFollowupObservations || reviewMode ? (
            <div id={reviewTarget.actionFollowupObservations.anchorId} className="info-item full review-target" style={{ marginTop: 16 }}>
              <dt><span>Observaciones</span><ReviewMarker target={reviewTarget.actionFollowupObservations} /></dt>
              <dd className="prose-value">{capa.actionFollowupObservations ?? "—"}</dd>
            </div>
          ) : null}

        </div>
      ) : null}

      {activeTab === "state" ? (
        <div className="card">
          <h2>Estado y eficacia</h2>
          <div className="state-efficacy-grid">
            <section id={reviewTarget.operationalState.anchorId} className="state-efficacy-panel review-target">
              <div className="review-target-heading"><h3>Estado operativo</h3><ReviewMarker target={reviewTarget.operationalState} /></div>
              <dl className="info-grid">
                <div className="info-item"><dt>Estado CAPA</dt><dd>{capaStatusLabel(capa.status)}</dd></div>
                <div className="info-item"><dt>Fecha de cierre y ejecución</dt><dd>{formatDate(capa.operationalClosedAt)}</dd></div>
                <div className="info-item full"><dt>Estado</dt><dd className="prose-value">{capa.operationalStatusDescription ?? capa.cancellationReason ?? "—"}</dd></div>
              </dl>
            </section>

            <section className="state-efficacy-panel">
              <h3>Evaluación de la eficacia</h3>
              <dl className="info-grid">
                <div className="info-item"><dt>Verificación de la eficacia</dt><dd>{effectivenessLabel(capa.effectivenessStatus)}</dd></div>
                <div className="info-item"><dt>Fecha de verificación final</dt><dd>{formatDate(capa.effectiveClosedAt)}</dd></div>
                <div id={reviewTarget.effectivenessAssessment.anchorId} className="info-item full review-target"><dt><span>Evaluación</span><ReviewMarker target={reviewTarget.effectivenessAssessment} /></dt><dd className="prose-value">{capa.effectivenessAssessment ?? "—"}</dd></div>
              </dl>
            </section>
          </div>

          <section className="state-efficacy-panel" style={{ marginTop: 14 }}>
            <h3>Conclusión</h3>
            <dl className="info-grid">
              <div id={reviewTarget.conclusion.anchorId} className="info-item full review-target"><dt><span>Conclusión / cierre</span><ReviewMarker target={reviewTarget.conclusion} /></dt><dd className="prose-value">{capa.conclusion ?? "—"}</dd></div>
              <div className="info-item"><dt>Fecha de próximo seguimiento</dt><dd>{formatDate(capa.nextFollowupDate)}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}

      {activeTab === "relations" ? (
        <div className="card">
          <h2>Orígenes de la CAPA</h2><AuditOriginPanel targetRecordId={capa.qmsRecordId}/><OosOriginPanel targetRecordId={capa.qmsRecordId}/>
          {origins.some(record => record.recordType !== "AUDIT") ? (
            <div className="relation-list">
              {origins.filter(record => record.recordType !== "AUDIT").map((record) => (
                <div className="relation-card" key={record.id}>
                  <span>{originRelationLabel(record.recordType)}</span>
                  <Link href={qmsRecordHref(record.recordType, record.id)}>
                    <strong>{qmsRecordDisplayCode(record, qmsRecordTypeLabel(record.recordType))}{!record.isActive ? " · Anulado" : ""}</strong>
                  </Link>
                  <small>Relación QMS canónica.</small>
                  {record.recordType !== "AUDIT" ? <PermissionGate permission="EDIT" recordId={record.id}><form action={unlinkCapaOriginAction.bind(null, id, record.id)}><CsrfField />
                    <ActorField type="hidden" name="actor" value={capa.createdByText ?? currentActor()} />
                    <button className="button danger small" type="submit">Desvincular</button>
                  </form></PermissionGate> : <small>Gestionar atribuciones desde la Auditoría.</small>}
                </div>
              ))}
            </div>
          ) : !origins.length && !hasOosOrigin ? <div className="empty-panel">No hay orígenes operativos vinculados.</div> : null}
          {capa.status === "DRAFT" ? (
            <div className="empty-panel">Las relaciones operativas se activan al abrir la CAPA.</div>
          ) : (
            <PermissionGate permission="EDIT"><OperationalRelationForm
              action={addCapaRelationAction.bind(null, id)}
              title="Vincular otro expediente de origen"
              codeLabel="Codificación de origen"
              codePlaceholder="Buscar expediente"
              buttonLabel="Vincular origen"
              defaultActor={currentActor()}
              targetOptions={[
                { value: "DEVIATION", label: "Desviación" },
                { value: "COMPLAINT", label: "Reclamación" },
              ]}
              currentRecordId={capa.qmsRecord.id}
              currentRecordType="CAPA"
            /></PermissionGate>
          )}
        </div>
      ) : null}

      {activeTab === "versions" ? (
        <div className="card">
          <div className="section-title-row">
            <div>
              <h2>Seguimientos del expediente</h2>
              <p className="muted-note">
                Seguimiento 00 corresponde a la apertura/registro inicial de la CAPA. El primer seguimiento posterior es 01; después 02, 03…
              </p>
            </div>
            {currentVersion ? <span className="badge neutral">Actual {followupLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          {capa.qmsRecord.versions.length ? (
            <div className="timeline">
              {[...capa.qmsRecord.versions].reverse().map((item) => {
                const summary = recordVersionSummary("CAPA", item.snapshot);
                const followupDate = capaSnapshotVersionFollowupDate(
                  item.snapshot,
                  item.sequenceNumber,
                );
                const signedDocument =
                  item.documents.find((document) => document.kind === "SIGNED_PDF") ?? null;
                return (
                  <article className="timeline-item" key={item.id}>
                    <div className="timeline-marker">{String(item.sequenceNumber).padStart(2, "0")}</div>
                    <div>
                      <header>
                        <strong>{followupLabel(item.sequenceNumber)}</strong>
                        <span className={`badge ${summary.status === "OPEN" ? "open" : summary.status === "CLOSED" ? "closed" : "neutral"}`}>
                          {capaStatusLabel(String(summary.status ?? "OPEN"))}
                        </span>
                        <span
                          className={`badge ${
                            summary.effectivenessStatus === "CONFORMING"
                              ? "conforming"
                              : summary.effectivenessStatus === "NONCONFORMING"
                                ? "nonconforming"
                                : "neutral"
                          }`}
                        >
                          Eficacia {effectivenessLabel(String(summary.effectivenessStatus ?? "PENDING"))}
                        </span>
                        {item.frozenAt ? <span className="badge neutral">Histórico</span> : <span className="badge neutral">Vigente</span>}
                      </header>
                      <p>Fecha del seguimiento: {formatDate(followupDate)} · Próximo seguimiento: {formatDate(summary.nextFollowupDate)} · Cierre y ejecución: {formatDate(summary.closedAt)}</p>
                      <p>Verificación final: {formatDate(summary.effectiveClosedAt)}{item.reason ? ` · Motivo: ${item.reason}` : ""}</p>
                      <small className="muted-note">Registrado {formatDate(item.createdAt)} · {item.createdByText ?? "Sistema"}</small>
                      <div className="document-actions">
                        {capa.status === "DRAFT" ? (
                          <span className="muted-note">El Anexo III estará disponible al abrir la CAPA.</span>
                        ) : (
                          <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button small" href={`/api/capa/${id}/annex-iii?version=${item.sequenceNumber}`}>
                            Descargar Anexo III · {followupLabel(item.sequenceNumber)}
                          </a></PermissionGate>
                        )}
                        {signedDocument ? (
                          <PermissionGate permission="DOWNLOAD"><a
                            className="button small"
                            href={`/api/capa/${id}/versions/${item.sequenceNumber}/signed-pdf`}
                          >
                            Descargar PDF firmado · {followupLabel(item.sequenceNumber)}
                          </a></PermissionGate>
                        ) : null}
                      </div>
                      <div className="version-signed-document">
                        <strong>PDF firmado: {signedDocument ? "Disponible" : "No disponible"}</strong>
                        {signedDocument ? (
                          <small className="muted-note">
                            {signedDocument.fileName} · {Math.max(1, Math.round(signedDocument.fileSize / 1024))} KB · cargado {formatDate(signedDocument.uploadedAt)} · {signedDocument.uploadedByText ?? "Usuario no informado"}
                          </small>
                        ) : (
                          <small className="muted-note">
                            Este PDF corresponde exclusivamente a {followupLabel(item.sequenceNumber)} y no se copia a seguimientos posteriores.
                          </small>
                        )}
                        {capa.status === "DRAFT" ? (
                          <small className="muted-note">
                            La carga de PDF firmado se habilita cuando la CAPA deja de estar en Borrador.
                          </small>
                        ) : (
                          <PermissionGate permission="ATTACH_DOCUMENT"><SignedVersionDocumentForm
                            action={uploadCapaSignedPdfAction.bind(null, id, item.id)}
                            defaultActor={currentActor()}
                            replace={Boolean(signedDocument)}
                          /></PermissionGate>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="empty-panel">Este expediente todavía no tiene snapshot persistido.</div>}
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <div className="card">
          <h2>Documentos</h2>
          <dl className="info-grid">
            <div className="info-item"><dt>Versión formulario</dt><dd>{capa.formVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item"><dt>Plantilla Anexo III</dt><dd>{capa.annexIIITemplateVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item">
              <dt>PDF firmados por seguimiento</dt>
              <dd>{capa.qmsRecord.versions.length ? `${signedFollowupNumbers.length} de ${capa.qmsRecord.versions.length} disponibles` : "Sin seguimientos"}</dd>
            </div>
            <div className="info-item full">
              <dt>Seguimientos con PDF firmado</dt>
              <dd>
                {signedFollowupNumbers.length
                  ? signedFollowupNumbers.map((sequence) => followupLabel(sequence)).join(", ")
                  : "Ninguno"}
                {" · "}
                <Link href={`/capa/${id}?tab=versions`}>Gestionar en Seguimientos</Link>
              </dd>
            </div>
          </dl>
          <div className="document-grid">
            <div className="document-block">
              <h3>Anexo III · Informe CAPA</h3>
              <p>Plantilla oficial y versión Word cumplimentada del informe/seguimiento CAPA.</p>
              <div className="document-actions">
                {capa.annexIIITemplateVersion?.id ? <PermissionGate permission="DOWNLOAD" module="CAPA"><a className="button" href={`/api/settings/templates/${capa.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a></PermissionGate> : <span className="muted-note">Plantilla oficial pendiente de cargar.</span>}
                {capa.status === "DRAFT" ? <span className="muted-note">Disponible al abrir la CAPA.</span> : <PermissionGate permission={["GENERATE_DOCUMENT","DOWNLOAD"]}><a className="button primary" href={`/api/capa/${id}/annex-iii`}>Generar Anexo III cumplimentado</a></PermissionGate>}
              </div>
            </div>
            <div className="document-block">
              <h3>Anexo IV · Listado CAPA</h3>
              <p>Listado oficial anual de CAPA. Se descarga desde el listado principal para el año seleccionado.</p>
              <Link className="button" href="/capa">Ir al listado y descargar Anexo IV</Link>
            </div>
          </div>
          {capa.qmsRecord.generatedDocuments.length ? (
            <>
              <h3>Generaciones registradas</h3>
              <div className="timeline">
                {capa.qmsRecord.generatedDocuments.map((item) => (
                  <div className="timeline-item document-generation-item" key={item.id}>
                    <strong className="document-generation-type">{item.documentType}</strong>
                    <small className="muted-note document-generation-meta">
                      Generado {formatDate(item.generatedAt)} · {item.generatedByText ?? "Usuario no informado"}
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
                <p className="muted-note">Observaciones vinculadas al seguimiento funcional revisado cuando exista.</p>
              </div>
              <PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={qmsWithReturnTo(reviewModeHref(basePath, "review", reviewMode), "/capa", returnTo)} /></PermissionGate>
            </div>
            <ReviewStatusSummary />
          </div>
          <ReviewThreadList />
        </div>
      ) : null}

      {activeTab === "timeline" ? <RecordTimeline qmsRecordId={capa.qmsRecord.id} /> : null}
      {activeTab === "audit-trail" ? <AuditTrailPanel rootKey={`QMS_RECORD:${capa.qmsRecord.id}`} basePath={basePath} page={Number(auditPage)||1}/> : null}
    </section>
    <ReviewDrawer />
    </ReviewWorkspaceProvider>
  );
}

export default async function CapaDetailPage(...args: Parameters<typeof CapaDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/capa/[id]/page.tsx", () => CapaDetailPageAuthenticatedContent(...args), args);
}
