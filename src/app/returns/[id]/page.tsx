import Link from "next/link";
import { qmsListingReturnTo, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { notFound } from "next/navigation";
import {
  addReturnFollowupAction,
  addReturnRelationAction,
  unlinkReturnComplaintAction,
} from "@/modules/returns/actions";
import {
  formatDate,
  productTypeLabel,
  returnDecisionLabel,
  returnStatusLabel,
  returnTypeLabel,
  tri,
} from "@/modules/returns/domain";
import { getReturnDetail } from "@/modules/returns/queries";
import { BasicFollowupForm } from "@/components/basic-followup-form";
import { qmsRecordHref, qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { OperationalRelationForm } from "@/components/operational-relation-form";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { SignedVersionDocumentForm } from "@/components/signed-version-document-form";
import { uploadReturnSignedPdfAction } from "@/modules/returns/signed-document-actions";
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
  returnFollowupReviewTarget,
  returnProductReviewTarget,
  returnReviewTargets,
} from "@/lib/qms/review/targets/returns";

import {contextFromExtraData} from "@/modules/returns/rules";

export const dynamic = "force-dynamic";

const tabs = [
  ["summary", "Resumen"],
  ["checks", "Comprobaciones"],
  ["followups", "Seguimientos"],
  ["relations", "Relaciones"],
  ["documents", "Documentos"],
  ["review", "Revisión"],
  ["history", "Historial"],
] as const;

const txt = (value: string | null | undefined) => value || "—";

export default async function ReturnDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; review?: string; thread?: string; returnTo?: string }>;
}) {
  const { id } = await params;
  const { tab: raw, review, thread, returnTo } = await searchParams;
  const tab = tabs.some(([key]) => key === raw) ? raw! : "summary";
  const r = await getReturnDetail(id);
  if (!r) notFound();

  const complaintOrigins = r.qmsRecord.targetRelations
    .filter(
      (item) =>
        item.relationType === "GENERATES" &&
        item.sourceRecord.recordType === "COMPLAINT",
    )
    .map((item) => item.sourceRecord);
  const primaryComplaintOrigin =
    complaintOrigins.length === 1 ? complaintOrigins[0] : null;
  const currentTechnicalVersion = r.qmsRecord.versions.at(-1) ?? null;
  const signedAnnexIII =
    currentTechnicalVersion?.documents.find(
      (item) => item.kind === "RETURN_ANNEX_III_SIGNED",
    ) ?? null;
  const signedAnnexV =
    currentTechnicalVersion?.documents.find(
      (item) => item.kind === "RETURN_ANNEX_V_SIGNED",
    ) ?? null;

  const reviewMode = review === "1";
  const basePath = `/returns/${id}`;
  const reviewThreads = await getReviewThreadsForDisplay(r.qmsRecord.id);
  const reviewActiveCount = activeReviewCount({
    PENDING: reviewThreads.filter((item) => item.status === "PENDING").length,
    ACCEPTED: reviewThreads.filter((item) => item.status === "ACCEPTED").length,
  });

  const generalChecks = [
    ["Plazo aceptable", r.withinAcceptedReturnPeriod],
    ["+15/+25 ºC ≤10 días", r.roomTemperatureWithinTenDays],
    ["+2/+8 ºC ≤48 h", r.coldChainWithinFortyEightHours],
    ["Data Matrix activo", r.uniqueIdentifierActive],
    ["Tamper Evidence intacto", r.tamperEvidenceIntact],
    ["Envases íntegros", r.packagingIntegrityOk],
    ["Declaración cliente", r.customerDeclarationAvailable],
    ["Conservación/transporte conforme", r.storageTransportConditionsOk],
    ["Sin uso/daño/contaminación", r.noUseDamageContamination],
    ["Sin retirada/alerta/bloqueo", r.noRecallAlertBlock],
    ["Caducidad aceptable", r.expiryAcceptable],
    ["Evaluación QC", r.qcAssessmentCompleted],
  ] as const;
  const temperatureChecks = [
    ["Registro almacenamiento", r.storageTemperatureRecord],
    ["Temperatura retorno", r.returnTransportTempEvidence],
    ["Embalaje conforme", r.transportPackagingSuitable],
    ["Temperatura recepción", r.receiptTemperatureAcceptable],
    ["Excursión evaluada", r.temperatureExcursionEvaluated],
    ["Sistema validado", r.coldChainReturnSystemValidated],
  ] as const;

  const reviewTarget = {
    generalData: reviewTargetWithValue(returnReviewTargets.generalData, {
      customerEntity: txt(r.customerEntity),
      country: txt(r.country),
      communicationDate: formatDate(r.communicationDate),
      receivedAt: formatDate(r.receivedAt),
      department: r.departmentCodeSnapshot ?? r.department?.code ?? "—",
      returnType: returnTypeLabel(r.returnType),
      address: txt(r.address),
      conservationConditions: txt(r.conservationConditions),
      deliveryNote: txt(r.deliveryNote),
    }),
    reasonObservations: reviewTargetWithValue(
      returnReviewTargets.reasonObservations,
      r.reasonObservations,
    ),
    attachedDocumentation: reviewTargetWithValue(
      returnReviewTargets.attachedDocumentation,
      r.attachedDocumentation,
    ),
    decision: reviewTargetWithValue(
      returnReviewTargets.decision,
      returnDecisionLabel(r.decision),
    ),
    finalDestination: reviewTargetWithValue(
      returnReviewTargets.finalDestination,
      r.finalDestination,
    ),
    traceabilityUpdated: reviewTargetWithValue(
      returnReviewTargets.traceabilityUpdated,
      tri(r.traceabilityUpdated),
    ),
    products: reviewTargetWithValue(
      returnReviewTargets.products,
      r.products.map((item) => item.productNameCode),
    ),
    checksGeneral: reviewTargetWithValue(
      returnReviewTargets.checksGeneral,
      Object.fromEntries(
        generalChecks.map(([label, value]) => [label, tri(value)]),
      ),
    ),
    checksTemperature: reviewTargetWithValue(
      returnReviewTargets.checksTemperature,
      Object.fromEntries(
        temperatureChecks.map(([label, value]) => [label, tri(value)]),
      ),
    ),
    followups: reviewTargetWithValue(
      returnReviewTargets.followups,
      r.followups.map((item) => item.comment),
    ),
    complaintOrigin: reviewTargetWithValue(
      returnReviewTargets.complaintOrigin,
      {
        records: complaintOrigins.map((record) =>
          qmsRecordDisplayCode(record, "Reclamación"),
        ),
        relatedDocument: txt(r.relatedDocument),
      },
    ),
  };

  const productReviewTargets = r.products.map((item) =>
    returnProductReviewTarget(item.id, {
      productNameCode: item.productNameCode,
      productType: productTypeLabel(item.productType),
      format: txt(item.format),
      lot: txt(item.lot),
      expiryReanalysis: txt(item.expiryReanalysis),
      quantity: [item.quantity, item.unit].filter(Boolean).join(" ") || "—",
      netWeight: txt(item.netWeight),
      grossWeight: txt(item.grossWeight),
      receptionObservations: txt(item.receptionObservations),
    }),
  );
  const followupReviewTargets = r.followups.map((item) =>
    returnFollowupReviewTarget(item.id, {
      followupDate: formatDate(item.followupDate),
      completedByText: item.completedByText,
      comment: item.comment,
      nextFollowupDate: formatDate(item.nextFollowupDate),
      evidenceReference: txt(item.evidenceReference),
    }),
  );
  const reviewTargets = [
    ...Object.values(reviewTarget),
    ...productReviewTargets,
    ...followupReviewTargets,
  ];
  const productTargetById = new Map(
    productReviewTargets.map((target) => [target.targetEntityId!, target]),
  );
  const followupTargetById = new Map(
    followupReviewTargets.map((target) => [target.targetEntityId!, target]),
  );

  return (
    <ReviewWorkspaceProvider
      qmsRecordId={r.qmsRecord.id}
      module="RETURN"
      basePath={basePath}
      currentVersionLabel=""
      showVersionContext={false}
      recordVersionAssociation="NONE"
      defaultActor={
        process.env.DEFAULT_ACTOR_NAME?.trim() || r.createdByText || "Usuario demo"
      }
      reviewMode={reviewMode}
      targets={reviewTargets}
      threads={reviewThreads}
      initialThreadId={thread}
    >
      <section className={`workspace${reviewMode ? " review-mode-active" : ""}`}>
        <div className="record-header">
          <div>
            <p className="eyebrow">
              <Link href={qmsListingReturnTo("/returns", returnTo)}>← Devoluciones</Link>
            </p>
            <div className="record-title-line">
              <h1>{qmsRecordDisplayCode(r.qmsRecord)}</h1>
              <span
                className={`badge ${
                  r.status === "DRAFT"
                    ? "neutral"
                    : r.status === "OPEN"
                      ? "open"
                      : "closed"
                }`}
              >
                {returnStatusLabel(r.status)}
              </span>
              <span className="badge neutral">{returnTypeLabel(r.returnType)}</span>
              <span className="badge neutral">{returnDecisionLabel(r.decision)}</span>
            </div>
            <p className="muted-note">
              Comunicación {formatDate(r.communicationDate)} · {txt(r.customerEntity)}
            </p>
          </div>
          <div className="record-actions">
            <ReviewModeToggle
              active={reviewMode}
              href={qmsWithReturnTo(reviewModeHref(basePath, tab, reviewMode), "/returns", returnTo)}
            />
            {r.qmsRecord.isActive?<Link className="button primary" href={qmsWithReturnTo(`/returns/${id}/edit`, "/returns", returnTo)}>
              Editar
            </Link>:null}
            {r.qmsRecord.isActive&&r.status === "OPEN" ? (
              <Link
                className="button"
                href={`${reviewTabHref(basePath, "followups", reviewMode)}#new-followup`}
              >
                + Seguimiento
              </Link>
            ) : null}
          </div>
        </div>

        {r.status === "DRAFT" ? (
          <div className="analytics-note">
            <strong>Borrador:</strong> esta devolución todavía no es operativa.
            Completa los campos obligatorios y cambia el estado a Abierta para iniciar
            su ciclo formal.
          </div>
        ) : null}

        <QmsAdministrativeStatus
          qmsRecordId={r.qmsRecord.id}
          isActive={r.qmsRecord.isActive}
          code={qmsRecordDisplayCode(r.qmsRecord)}
          annulledAt={r.qmsRecord.annulledAt?.toISOString() ?? null}
          annulledByText={r.qmsRecord.annulledByText}
          annulledReason={r.qmsRecord.annulledReason}
          defaultActor={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
        />

        <nav className="record-tabs">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              className={tab === key ? "active" : ""}
              href={qmsWithReturnTo(reviewTabHref(basePath, key, reviewMode), "/returns", returnTo)}
            >
              {key === "review" ? `${label} (${reviewActiveCount})` : label}
            </Link>
          ))}
        </nav>

        {tab === "summary" ? (
          <>
            <div className="return-summary-hero">
              <div
                id={reviewTarget.generalData.anchorId}
                className="card return-summary-card review-target"
              >
                <div className="review-target-heading">
                  <h2>Datos generales</h2>
                  <ReviewMarker target={reviewTarget.generalData} />
                </div>
                <dl className="info-grid return-summary-grid">
                  <div className="info-item">
                    <dt>Cliente / entidad</dt>
                    <dd>{txt(r.customerEntity)}</dd>
                  </div>
                  <div className="info-item">
                    <dt>País</dt>
                    <dd>{txt(r.country)}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Fecha comunicación</dt>
                    <dd>{formatDate(r.communicationDate)}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Fecha recepción</dt>
                    <dd>{formatDate(r.receivedAt)}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Área</dt>
                    <dd>{r.departmentCodeSnapshot ?? r.department?.code ?? "—"}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Tipo</dt>
                    <dd>{returnTypeLabel(r.returnType)}</dd>
                  </div>
                  <div
                    id={reviewTarget.decision.anchorId}
                    className="info-item review-target"
                  >
                    <dt>
                      <span>Decisión</span>
                      <ReviewMarker target={reviewTarget.decision} />
                    </dt>
                    <dd>{returnDecisionLabel(r.decision)}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Fecha decisión</dt>
                    <dd>{formatDate(r.decisionDate)}</dd>
                  </div>
                  <div className="info-item full">
                    <dt>Dirección</dt>
                    <dd>{txt(r.address)}</dd>
                  </div>
                  <div className="info-item wide">
                    <dt>Condiciones de conservación</dt>
                    <dd>{txt(r.conservationConditions)}</dd>
                  </div>
                  <div className="info-item">
                    <dt>N.º albarán</dt>
                    <dd>{txt(r.deliveryNote)}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Fecha cierre</dt>
                    <dd>{formatDate(r.closedAt)}</dd>
                  </div>
                  <div
                    id={reviewTarget.reasonObservations.anchorId}
                    className="info-item full review-target"
                  >
                    <dt>
                      <span>Motivo / incidencias</span>
                      <ReviewMarker target={reviewTarget.reasonObservations} />
                    </dt>
                    <dd className="prose-value">{txt(r.reasonObservations)}</dd>
                  </div>
                  <div
                    id={reviewTarget.attachedDocumentation.anchorId}
                    className="info-item full review-target"
                  >
                    <dt>
                      <span>Documentación anexada</span>
                      <ReviewMarker target={reviewTarget.attachedDocumentation} />
                    </dt>
                    <dd className="prose-value">{txt(r.attachedDocumentation)}</dd>
                  </div>
                  <div
                    id={reviewTarget.finalDestination.anchorId}
                    className="info-item full review-target"
                  >
                    <dt>
                      <span>Destino final</span>
                      <ReviewMarker target={reviewTarget.finalDestination} />
                    </dt>
                    <dd className="prose-value">{txt(r.finalDestination)}</dd>
                  </div>
                  <div
                    id={reviewTarget.traceabilityUpdated.anchorId}
                    className="info-item review-target"
                  >
                    <dt>
                      <span>Trazabilidad actualizada</span>
                      <ReviewMarker target={reviewTarget.traceabilityUpdated} />
                    </dt>
                    <dd>{tri(r.traceabilityUpdated)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div
              id={reviewTarget.products.anchorId}
              className="card review-target"
            >
              <div className="section-title-row">
                <div>
                  <div className="review-target-heading">
                    <h2>Productos devueltos</h2>
                    <ReviewMarker target={reviewTarget.products} />
                  </div>
                  <p className="section-help">
                    Detalle de los productos incluidos en esta devolución.
                  </p>
                </div>
                <span className="badge neutral">
                  {r.products.length} {r.products.length === 1 ? "producto" : "productos"}
                </span>
              </div>
              <div className="return-product-summary-grid">
                {r.products.map((item, index) => {
                  const target = productTargetById.get(item.id)!;
                  return (
                    <article
                      id={target.anchorId}
                      className="return-product-summary-card review-target"
                      key={item.id}
                    >
                      <header>
                        <strong>{item.productNameCode}</strong>
                        <span className="badge neutral">Producto {index + 1}</span>
                        <ReviewMarker target={target} />
                      </header>
                      <dl className="info-grid">
                        <div className="info-item">
                          <dt>Tipo</dt>
                          <dd>{productTypeLabel(item.productType)}</dd>
                        </div>
                        <div className="info-item">
                          <dt>Formato</dt>
                          <dd>{txt(item.format)}</dd>
                        </div>
                        <div className="info-item">
                          <dt>Lote</dt>
                          <dd>{txt(item.lot)}</dd>
                        </div>
                        <div className="info-item">
                          <dt>Cad./reanálisis</dt>
                          <dd>{txt(item.expiryReanalysis)}</dd>
                        </div>
                        <div className="info-item">
                          <dt>Cantidad</dt>
                          <dd>{[item.quantity, item.unit].filter(Boolean).join(" ") || "—"}</dd>
                        </div>
                        <div className="info-item">
                          <dt>Peso neto</dt>
                          <dd>{txt(item.netWeight)}</dd>
                        </div>
                        <div className="info-item">
                          <dt>Peso bruto</dt>
                          <dd>{txt(item.grossWeight)}</dd>
                        </div>
                        <div className="info-item full">
                          <dt>Observaciones recepción</dt>
                          <dd className="prose-value">
                            {txt(item.receptionObservations)}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h2>Reclamación de origen</h2>
              {complaintOrigins.length ? (
                <div className="relation-list">
                  {complaintOrigins.map((record) => (
                    <div className="relation-card" key={record.id}>
                      <span>Reclamación de origen</span>
                      <Link href={qmsRecordHref(record.recordType, record.id)}>
                        <strong>
                          {qmsRecordDisplayCode(record, "Reclamación")}
                          {!record.isActive ? " · Anulado" : ""}
                        </strong>
                      </Link>
                      <small>El código abre la Reclamación relacionada.</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-panel">
                  {primaryComplaintOrigin
                    ? null
                    : "No existe una reclamación de origen vinculada."}
                </div>
              )}
              <dl className="info-grid return-related-document">
                <div className="info-item full">
                  <dt>Documento relacionado</dt>
                  <dd>
                    {primaryComplaintOrigin ? (
                      <Link
                        href={qmsRecordHref(
                          primaryComplaintOrigin.recordType,
                          primaryComplaintOrigin.id,
                        )}
                      >
                        {r.relatedDocument ??
                          primaryComplaintOrigin.businessCode ??
                          "Reclamación"}
                      </Link>
                    ) : (
                      txt(r.relatedDocument)
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </>
        ) : null}

        {tab === "checks" ? (
          <div className="return-check-sections">
            <div
              id={reviewTarget.checksGeneral.anchorId}
              className="card review-target"
            >
              <div className="review-target-heading">
                <h2>Comprobaciones para posible reintegración</h2>
                <ReviewMarker target={reviewTarget.checksGeneral} />
              </div>
              <div className="return-check-grid-display">
                {generalChecks.map(([label, value]) => (
                  <div className="return-check-item" key={label}>
                    <span>{label}</span>
                    <strong>{tri(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div
              id={reviewTarget.checksTemperature.anchorId}
              className="card review-target"
            >
              <div className="review-target-heading">
                <h2>Termolábiles / temperatura controlada</h2>
                <ReviewMarker target={reviewTarget.checksTemperature} />
              </div>
              <div className="return-check-grid-display">
                {temperatureChecks.map(([label, value]) => (
                  <div className="return-check-item" key={label}>
                    <span>{label}</span>
                    <strong>{tri(value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "followups" ? (
          r.status === "DRAFT" ? (
            <div className="empty-panel">
              Los seguimientos estarán disponibles cuando la devolución pase a estado
              Abierta.
            </div>
          ) : (
            <>
              <div
                id={reviewTarget.followups.anchorId}
                className="card review-target"
              >
                <div className="review-target-heading">
                  <h2>Seguimientos</h2>
                  <ReviewMarker target={reviewTarget.followups} />
                </div>
                {r.followups.length ? (
                  <div className="return-followup-list">
                    {r.followups.map((item) => {
                      const target = followupTargetById.get(item.id)!;
                      return (
                        <article
                          id={target.anchorId}
                          className="return-followup-card review-target"
                          key={item.id}
                        >
                          <div className="return-followup-field">
                            <span>Fecha</span>
                            <strong>{formatDate(item.followupDate)}</strong>
                          </div>
                          <div className="return-followup-field">
                            <span>Responsable</span>
                            <strong>{item.completedByText}</strong>
                          </div>
                          <div className="return-followup-field return-followup-comment">
                            <span>
                              Seguimiento <ReviewMarker target={target} />
                            </span>
                            <p>{item.comment}</p>
                          </div>
                          <div className="return-followup-field">
                            <span>Próximo seguimiento</span>
                            <strong>{formatDate(item.nextFollowupDate)}</strong>
                          </div>
                          <div className="return-followup-field">
                            <span>Evidencia</span>
                            <strong>{txt(item.evidenceReference)}</strong>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-panel">Sin seguimientos.</div>
                )}
              </div>
              {r.qmsRecord.isActive&&r.status === "OPEN" ? (
                <div className="card" id="new-followup">
                  <h2>Nuevo seguimiento</h2>
                  <BasicFollowupForm reloadOnSuccess nextFollowupRequired={contextFromExtraData(r.extraData).requiresFollowup}
                    action={addReturnFollowupAction.bind(null, id)}
                    defaultActor={
                      process.env.DEFAULT_ACTOR_NAME || "Usuario demo"
                    }
                  />
                </div>
              ) : null}
            </>
          )
        ) : null}

        {tab === "relations" ? (
          r.status === "DRAFT" ? (
            <div className="empty-panel">
              La relación con la reclamación de origen estará disponible cuando la
              devolución pase a estado Abierta.
            </div>
          ) : (
            <div
              id={reviewTarget.complaintOrigin.anchorId}
              className="card review-target"
            >
              <div className="review-target-heading">
                <h2>Reclamación de origen</h2>
                <ReviewMarker target={reviewTarget.complaintOrigin} />
              </div>
              <p className="section-help">
                Una devolución vinculada a una reclamación conserva una única relación
                canónica Reclamación → Devolución. Desvincular conserva ambos
                expedientes.
              </p>
              {complaintOrigins.length ? (
                <div className="relation-list">
                  {complaintOrigins.map((record) => (
                    <div className="relation-card" key={record.id}>
                      <span>Reclamación de origen</span>
                      <Link href={qmsRecordHref(record.recordType, record.id)}>
                        <strong>
                          {qmsRecordDisplayCode(record, "Reclamación")}
                          {!record.isActive ? " · Anulado" : ""}
                        </strong>
                      </Link>
                      <small>Vista inversa de la relación QMS.</small>
                      <form
                        action={unlinkReturnComplaintAction.bind(
                          null,
                          id,
                          record.id,
                        )}
                      >
                        <input
                          type="hidden"
                          name="actor"
                          value={
                            r.createdByText ??
                            process.env.DEFAULT_ACTOR_NAME ??
                            "Usuario demo"
                          }
                        />
                        <button className="button danger small" type="submit">
                          Desvincular
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-panel">
                  Esta devolución no tiene una reclamación de origen vinculada.
                </div>
              )}
              <OperationalRelationForm
                action={addReturnRelationAction.bind(null, id)}
                title="Vincular reclamación existente"
                codeLabel="Codificación de reclamación"
                codePlaceholder="R/GC-00/001/2026"
                buttonLabel="Vincular reclamación"
                defaultActor={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
                targetOptions={[{ value: "COMPLAINT", label: "Reclamación" }]}
                currentRecordId={r.qmsRecord.id}
                currentRecordType="RETURN"
              />
            </div>
          )
        ) : null}

        {tab === "documents" ? (
          r.status === "DRAFT" ? (
            <div className="empty-panel">
              Los documentos oficiales estarán disponibles cuando la devolución pase a
              estado Abierta.
            </div>
          ) : (
            <div className="card">
              <div className="section-title-row">
                <div>
                  <h2>Documentos</h2>
                  <p className="section-help">
                    Documentos oficiales de la devolución y copias PDF firmadas
                    recibidas.
                  </p>
                </div>
                <div className="relation-chips">
                  <span
                    className={`badge ${signedAnnexIII ? "conforming" : "neutral"}`}
                  >
                    Anexo III firmado: {signedAnnexIII ? "Sí" : "No"}
                  </span>
                  <span
                    className={`badge ${signedAnnexV ? "conforming" : "neutral"}`}
                  >
                    Anexo V firmado: {signedAnnexV ? "Sí" : "No"}
                  </span>
                </div>
              </div>
              <div className="document-grid return-document-grid">
                <div className="document-block return-document-block featured">
                  <h3>Anexo III · Formulario de devolución</h3>
                  <p>
                    Genera el Word cumplimentado. Cuando el documento esté firmado,
                    adjunta aquí la copia PDF correspondiente al expediente.
                  </p>
                  <div className="document-actions">
                    {r.annexIIITemplateVersion?.id ? (
                      <a
                        className="button"
                        href={`/api/settings/templates/${r.annexIIITemplateVersion.id}/download`}
                      >
                        Descargar plantilla oficial
                      </a>
                    ) : (
                      <span className="muted-note">
                        Plantilla pendiente de cargar.
                      </span>
                    )}
                    <a
                      className="button primary"
                      href={`/api/returns/${id}/annex-iii`}
                    >
                      Generar Anexo III cumplimentado
                    </a>
                    {signedAnnexIII ? (
                      <a
                        className="button"
                        href={`/api/returns/${id}/signed-pdf/annex-iii`}
                      >
                        Descargar PDF firmado
                      </a>
                    ) : null}
                  </div>
                  <div className="return-signed-document">
                    <strong>
                      {signedAnnexIII
                        ? "PDF firmado disponible"
                        : "PDF firmado pendiente"}
                    </strong>
                    {signedAnnexIII ? (
                      <small className="muted-note">
                        {signedAnnexIII.fileName} ·{" "}
                        {Math.max(1, Math.round(signedAnnexIII.fileSize / 1024))} KB
                        · cargado {formatDate(signedAnnexIII.uploadedAt)} ·{" "}
                        {signedAnnexIII.uploadedByText ?? "Usuario no informado"}
                      </small>
                    ) : (
                      <small className="muted-note">
                        Adjunta el PDF firmado del Anexo III cuando esté disponible.
                      </small>
                    )}
                    <SignedVersionDocumentForm reloadOnSuccess
                      action={uploadReturnSignedPdfAction.bind(
                        null,
                        id,
                        "annex-iii",
                      )}
                      defaultActor={
                        r.createdByText ??
                        process.env.DEFAULT_ACTOR_NAME ??
                        "Usuario demo"
                      }
                      replace={Boolean(signedAnnexIII)}
                    />
                  </div>
                </div>
                <div className="document-block return-document-block featured">
                  <h3>Anexo V · Declaración cliente</h3>
                  <p>
                    Genera el Word para remitir al cliente. El PDF devuelto por el
                    cliente se archiva aquí como documento firmado.
                  </p>
                  <div className="document-actions">
                    {r.annexVTemplateVersion?.id ? (
                      <a
                        className="button"
                        href={`/api/settings/templates/${r.annexVTemplateVersion.id}/download`}
                      >
                        Descargar plantilla oficial
                      </a>
                    ) : null}
                    <a
                      className="button primary"
                      href={`/api/returns/${id}/annex-v`}
                    >
                      Generar Anexo V
                    </a>
                    {signedAnnexV ? (
                      <a
                        className="button"
                        href={`/api/returns/${id}/signed-pdf/annex-v`}
                      >
                        Descargar PDF devuelto
                      </a>
                    ) : null}
                  </div>
                  <div className="return-signed-document">
                    <strong>
                      {signedAnnexV
                        ? "PDF del cliente disponible"
                        : "PDF del cliente pendiente"}
                    </strong>
                    {signedAnnexV ? (
                      <small className="muted-note">
                        {signedAnnexV.fileName} ·{" "}
                        {Math.max(1, Math.round(signedAnnexV.fileSize / 1024))} KB ·
                        cargado {formatDate(signedAnnexV.uploadedAt)} ·{" "}
                        {signedAnnexV.uploadedByText ?? "Usuario no informado"}
                      </small>
                    ) : (
                      <small className="muted-note">
                        Adjunta el PDF del Anexo V devuelto por el cliente.
                      </small>
                    )}
                    <SignedVersionDocumentForm reloadOnSuccess
                      action={uploadReturnSignedPdfAction.bind(null, id, "annex-v")}
                      defaultActor={
                        r.createdByText ??
                        process.env.DEFAULT_ACTOR_NAME ??
                        "Usuario demo"
                      }
                      replace={Boolean(signedAnnexV)}
                    />
                  </div>
                </div>
                <div className="document-block return-document-block">
                  <h3>Anexo IV · Hoja de devolución</h3>
                  <p>Se genera una hoja vertical por producto/lote registrado.</p>
                  <div className="document-actions">
                    {r.annexIVTemplateVersion?.id ? (
                      <a
                        className="button"
                        href={`/api/settings/templates/${r.annexIVTemplateVersion.id}/download`}
                      >
                        Descargar plantilla oficial
                      </a>
                    ) : null}
                    {r.products.map((product) => (
                      <a
                        key={product.id}
                        className="button small primary"
                        href={`/api/returns/${id}/annex-iv?product=${product.id}`}
                      >
                        Generar · {product.productNameCode}
                        {product.lot ? ` · ${product.lot}` : ""}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="document-block return-document-block">
                  <h3>Anexo VI · Listado de devoluciones</h3>
                  <p>
                    Listado oficial anual en Excel. Se descarga desde el listado
                    principal.
                  </p>
                  <Link className="button" href="/returns">
                    Ir al listado y descargar Anexo VI
                  </Link>
                </div>
              </div>
              {r.qmsRecord.generatedDocuments.length ? (
                <>
                  <h3>Generaciones registradas</h3>
                  <div className="timeline return-timeline">
                    {r.qmsRecord.generatedDocuments.map((item) => (
                      <div
                        className="timeline-item return-timeline-item document-generation-item"
                        key={item.id}
                      >
                        <strong className="document-generation-type">
                          {item.documentType}
                        </strong>
                        {item.fileName?<a className="button small" href={`/api/returns/${id}/documents/${item.id}`}>Descargar archivo histórico</a>:null}
                        <small className="muted-note document-generation-meta">
                          Generado {formatDate(item.generatedAt)} ·{" "}
                          {item.generatedByText ?? "Usuario no informado"}
                        </small>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )
        ) : null}

        {tab === "review" ? (
          <div className="review-overview">
            <div className="card">
              <div className="section-title-row">
                <div>
                  <h2>Revisión del expediente</h2>
                  <p className="muted-note">
                    Observaciones vinculadas al expediente editable. Devoluciones no
                    utiliza versiones funcionales de usuario.
                  </p>
                </div>
                <ReviewModeToggle
                  active={reviewMode}
                  href={qmsWithReturnTo(reviewModeHref(basePath, "review", reviewMode), "/returns", returnTo)}
                />
              </div>
              <ReviewStatusSummary />
            </div>
            <ReviewThreadList />
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="card">
            <h2>Historial interno de modificaciones</h2>
            <p className="muted-note">
              Historial administrativo del expediente. Devoluciones mantiene un único
              expediente editable, sin revisiones funcionales.
            </p>
            {r.qmsRecord.history.length ? (
              <div className="timeline return-timeline">
                {r.qmsRecord.history.map((item) => (
                  <div
                    className="timeline-item return-timeline-item history-entry"
                    key={item.id}
                  >
                    <header>
                      <strong>{formatDate(item.changedAt)}</strong>
                      <span>{item.changedByText ?? "Sistema"}</span>
                      <span className="badge neutral">{item.source}</span>
                    </header>
                    <p className="history-entry-detail">
                      <strong>{item.fieldPath}</strong>
                      {item.reason ? <span> · Motivo: {item.reason}</span> : null}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel">Sin cambios registrados.</div>
            )}
          </div>
        ) : null}
      </section>
      <ReviewDrawer />
    </ReviewWorkspaceProvider>
  );
}
