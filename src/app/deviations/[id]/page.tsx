import Link from "next/link";
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
import { uploadDeviationSignedPdfAction } from "@/modules/deviations/signed-document-actions";
import { SignedVersionDocumentForm } from "@/modules/deviations/components/signed-version-document-form";

import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";

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
  ["history", "Historial"],
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

export default async function DeviationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const activeTab = tabs.some(([key]) => key === rawTab) ? rawTab! : "summary";
  const deviation = await getDeviationDetail(id);
  if (!deviation) notFound();

  const code = qmsRecordDisplayCode(deviation.qmsRecord, "Sin codificación");
  const currentVersion = deviation.qmsRecord.versions.at(-1) ?? null;
  const currentSignedDocument = currentVersion?.documents.find((document) => document.kind === "SIGNED_PDF") ?? null;
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
    { label: "Equipo / línea afectada", value: deviation.affectedEquipmentLine },
    { label: "Documentación afectada", value: deviation.affectedDocumentation },
    { label: "Otro origen", value: deviation.otherOrigin },
  ].filter((item) => Boolean(item.value?.trim()));

  return (
    <section className="workspace">
      <div className="record-header">
        <div>
          <p className="eyebrow"><Link href="/deviations">← Desviaciones</Link></p>
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
          <Link className="button primary" href={`/deviations/${id}/edit`}>{deviation.status === "DRAFT" ? "Editar borrador" : "Editar/nueva versión"}</Link>
          {deviation.status === "DRAFT"
            ? <span className="muted-note">El Anexo III estará disponible al abrir la desviación.</span>
            : <a className="button" href={`/api/deviations/${id}/annex-iii`}>Generar Anexo III</a>}
        </div>
      </div>

      <QmsAdministrativeStatus
        qmsRecordId={deviation.qmsRecord.id}
        isActive={deviation.qmsRecord.isActive}
        code={qmsRecordDisplayCode(deviation.qmsRecord)}
        annulledAt={deviation.qmsRecord.annulledAt?.toISOString() ?? null}
        annulledByText={deviation.qmsRecord.annulledByText}
        annulledReason={deviation.qmsRecord.annulledReason}
        defaultActor={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
      />

      <nav className="record-tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={`/deviations/${id}?tab=${key}`}>{label}</Link>
        ))}
      </nav>

      {activeTab === "summary" ? (
        <>
          <div className="card deviation-summary-card">
            <h2>Resumen del expediente</h2>
            <dl className="info-grid compact-info-grid">
              <div className="info-item"><dt>Material / proceso</dt><dd>{text(deviation.materialProcessAffected)}</dd></div>
              <div className="info-item"><dt>Clasificación</dt><dd>{classificationLabel(deviation.classification)}</dd></div>
              <div className="info-item"><dt>En plazo</dt><dd>{deadlineLabel(deviation.deadlineStatus)}</dd></div>
              <div className="info-item"><dt>Fecha de cierre</dt><dd>{formatDate(deviation.closedAt)}</dd></div>
              <div className="info-item"><dt>Medidas adoptadas</dt><dd>{measuresLabel(deviation)}</dd></div>
              <div className="info-item"><dt>Documento firmado</dt><dd>{currentVersion ? `${versionLabel(currentVersion.sequenceNumber)} · ${currentSignedDocument ? "Disponible" : "No cargado"}` : "Sin versión"}</dd></div>
              <div className="info-item"><dt>Calidad del dato</dt><dd>{dataQualityLabel(deviation.dataQualityStatus)}</dd></div>
              <div className="info-item full"><dt>Observaciones internas</dt><dd className="prose-value">{text(deviation.internalObservations)}</dd></div>
            </dl>
          </div>

          {originDetails.length ? (
            <div className="card origin-card">
              <div className="section-title-row">
                <div>
                  <h2>Origen</h2>
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
            <h2>CAPA relacionadas</h2>
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
                          <td>{text(plan.responsible)}</td>
                          <td><span className="badge neutral">{capaProposalStatusLabel(plan.proposalStatus)}</span></td>
                          <td className="action-link-cell">
                            {navigation.kind === "OPEN" ? (
                              <Link className="button small" href={qmsRecordHref("CAPA", navigation.recordId)}>Abrir CAPA</Link>
                            ) : navigation.kind === "CREATE" ? (
                              <Link className="button small primary" href={`/capa/new?fromDeviationPlanId=${plan.id}`}>Crear CAPA</Link>
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
            <div className="info-item full"><dt>Qué sucedió / qué debía haber sucedido</dt><dd className="prose-value">{text(deviation.whatHappened)}</dd></div>
            {deviation.whoInvolved ? <div className="info-item"><dt>Quién estuvo implicado</dt><dd className="prose-value">{deviation.whoInvolved}</dd></div> : null}
            {deviation.whenHappened ? <div className="info-item"><dt>Cuándo ocurrió</dt><dd className="prose-value">{deviation.whenHappened}</dd></div> : null}
            {deviation.whereHappened ? <div className="info-item"><dt>Dónde ocurrió</dt><dd className="prose-value">{deviation.whereHappened}</dd></div> : null}
            {deviation.howHappened ? <div className="info-item"><dt>Cómo ocurrió / cómo se detectó</dt><dd className="prose-value">{deviation.howHappened}</dd></div> : null}
          </dl>
        </div>
      ) : null}

      {activeTab === "investigation" ? (
        <>
          <div className="card">
            <h2>Investigación</h2>
            <dl className="info-grid compact-info-grid">
              <div className="info-item full"><dt>Investigación realizada</dt><dd className="prose-value">{text(deviation.investigation)}</dd></div>
              <div className="info-item"><dt>Resultado</dt><dd>{investigationResultLabel(deviation.investigationConclusive)}</dd></div>
            </dl>
          </div>
          <div className="card root-cause-card">
            <h2>Causa raíz</h2>
            <dl className="info-grid compact-info-grid">
              <div className="info-item full"><dt>Causa raíz establecida</dt><dd className="prose-value">{text(deviation.rootCause)}</dd></div>
              <div className="info-item"><dt>Metodología</dt><dd>{deviation.investigationMethods.length ? deviation.investigationMethods.map(investigationMethodLabel).join(", ") : "No informada"}</dd></div>
              <div className="info-item"><dt>Recurrencia</dt><dd>{triStateLabel(deviation.recurrentRootCause)}</dd></div>
              <div className="info-item wide"><dt>Antecedentes / detalle</dt><dd className="prose-value">{text(deviation.recurrenceDetails)}</dd></div>
            </dl>
          </div>
          <div className="card">
            <h2>Evaluación de impacto</h2>
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
          <div className="card">
            <h2>Acciones inmediatas</h2>
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
                    {deviation.immediateActions.map((action, index) => (
                      <tr key={action.id}>
                        <td className="action-number-cell">{String(index + 1).padStart(2, "0")}</td>
                        <td className="action-description-cell">{action.description}</td>
                        <td>{text(action.executedBy)}</td>
                        <td>{formatDate(action.executedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-panel">No se han registrado acciones inmediatas.</div>}
          </div>
          <div className="card">
            <h2>CAPA propuestas</h2>
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
                      const capaCode =
                        plan.businessCapaCode ??
                        plan.linkedCapaRecord?.businessCode ??
                        (plan.proposalStatus === "PROPOSED" ? "Pendiente" : "—");
                      return (
                        <tr key={plan.id}>
                          <td className="action-number-cell">{String(index + 1).padStart(2, "0")}</td>
                          <td>
                            {navigation.kind === "OPEN" ? (
                              <Link className="summary-link" href={qmsRecordHref("CAPA", navigation.recordId)}>{capaCode}</Link>
                            ) : capaCode}
                          </td>
                          <td className="action-description-cell">{plan.description}</td>
                          <td>{formatDate(plan.plannedExecutionDate)}</td>
                          <td>{text(plan.responsible)}</td>
                          <td>{capaProposalStatusLabel(plan.proposalStatus)}</td>
                          <td className="action-link-cell">
                            {navigation.kind === "OPEN" ? (
                              <Link className="button small" href={qmsRecordHref("CAPA", navigation.recordId)}>Abrir CAPA</Link>
                            ) : navigation.kind === "CREATE" ? (
                              <Link className="button small primary" href={`/capa/new?fromDeviationPlanId=${plan.id}`}>Crear CAPA</Link>
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
            <div className="info-item full"><dt>Conclusión / cierre</dt><dd className="prose-value">{text(deviation.conclusion)}</dd></div>
            <div className="info-item"><dt>Disposición</dt><dd>{text(deviation.disposition)}</dd></div>
            <div className="info-item"><dt>Cantidad</dt><dd>{text(deviation.dispositionQuantity)}</dd></div>
            <div className="info-item"><dt>Notificación al cliente</dt><dd>{triStateLabel(deviation.clientNotification)}</dd></div>
            <div className="info-item"><dt>Fecha de cierre</dt><dd>{formatDate(deviation.closedAt)}</dd></div>
            <div className="info-item full"><dt>Comentarios de disposición</dt><dd className="prose-value">{text(deviation.dispositionComments)}</dd></div>
          </dl>
        </div>
      ) : null}

      {activeTab === "relations" ? (
        <div className="card">
          <h2>CAPA relacionadas</h2>
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
                  <form action={unlinkDeviationCapaAction.bind(null, id, record.id)}>
                    <input type="hidden" name="actor" value={deviation.createdByText ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo"} />
                    <button className="button danger small" type="submit">Desvincular</button>
                  </form>
                </div>
              ))}
            </div>
          ) : <div className="empty-panel">Esta desviación todavía no tiene CAPA vinculadas.</div>}
          <OperationalRelationForm
            action={addDeviationRelationAction.bind(null, id)}
            title="Vincular CAPA existente"
            codeLabel="Codificación CAPA"
            codePlaceholder="AC/GC-00/001/2026"
            buttonLabel="Vincular CAPA"
            defaultActor={deviation.createdByText ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo"}
            targetOptions={[{ value: "CAPA", label: "CAPA" }]}
            currentRecordId={deviation.qmsRecord.id}
            currentRecordType="DEVIATION"
          />
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
              {deviation.qmsRecord.versions.map((item) => {
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
                            <a className="button small" href={`/api/deviations/${id}/annex-iii?version=${item.sequenceNumber}`}>
                              Descargar Anexo III {versionLabel(item.sequenceNumber)}
                            </a>
                            {signedDocument ? (
                              <a
                                className="button small"
                                href={`/api/deviations/${id}/versions/${item.sequenceNumber}/signed-pdf`}
                              >
                                Descargar PDF firmado {versionLabel(item.sequenceNumber)}
                              </a>
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
                            <SignedVersionDocumentForm
                              action={uploadDeviationSignedPdfAction.bind(null, id, item.id)}
                              defaultActor={deviation.createdByText ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo"}
                              replace={Boolean(signedDocument)}
                            />
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
                {deviation.anexoIIITemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${deviation.anexoIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a> : <span className="muted-note">Plantilla oficial pendiente de cargar.</span>}
                <a className="button primary" href={`/api/deviations/${id}/annex-iii`}>Generar Anexo III cumplimentado</a>
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

      {activeTab === "history" ? (
        <div className="card">
          <h2>Historial interno de modificaciones</h2>
          <p className="muted-note">Historial operativo de V1. No constituye un audit trail GMP validado.</p>
          {deviation.qmsRecord.history.length ? (
            <div className="timeline">
              {deviation.qmsRecord.history.map((event) => (
                <div className="timeline-item history-entry" key={event.id}>
                  <header className="history-entry-header">
                    <strong>{formatDate(event.changedAt)}</strong>
                    <span>{event.changedByText ?? "Sistema"}</span>
                    <span className="badge neutral">{event.source}</span>
                  </header>
                  <p className="history-entry-detail">
                    <strong>{event.fieldPath}</strong>
                    {event.reason ? <span> · Motivo: {event.reason}</span> : null}
                  </p>
                </div>
              ))}
            </div>
          ) : <div className="empty-panel">Sin modificaciones registradas.</div>}
        </div>
      ) : null}
    </section>
  );
}
