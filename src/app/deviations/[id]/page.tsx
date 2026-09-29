import Link from "next/link";
import { notFound } from "next/navigation";
import { addDeviationFollowupAction, addDeviationRelationAction } from "@/modules/deviations/actions";
import { deadlineLabel, formatDate, measuresLabel, triStateLabel } from "@/modules/deviations/domain";
import { getDeviationDetail } from "@/modules/deviations/queries";
import { recordVersionSummary, versionLabel } from "@/lib/qms/versioning";
import { qmsRecordHref } from "@/lib/qms/record-links";
import {
  capaPlanNavigation,
  capaProposalStatusLabel,
} from "@/modules/capa/proposal-ui";
import { BasicFollowupForm } from "@/components/basic-followup-form";
import { OperationalRelationForm } from "@/components/operational-relation-form";

export const dynamic = "force-dynamic";

const tabs = [
  ["summary", "Resumen"],
  ["investigation", "Investigación"],
  ["actions", "Acciones"],
  ["followups", "Seguimientos"],
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

  const code = deviation.qmsRecord.businessCode ?? "Sin codificación";
  const currentVersion = deviation.qmsRecord.versions.at(-1) ?? null;
  const relatedCapas = deviation.qmsRecord.sourceRelations
    .filter(
      (relation) =>
        relation.relationType === "GENERATES" &&
        relation.targetRecord.recordType === "CAPA",
    )
    .map((relation) => relation.targetRecord);

  return (
    <section className="workspace">
      <div className="record-header">
        <div>
          <p className="eyebrow"><Link href="/deviations">← Desviaciones</Link></p>
          <div className="record-title-line">
            <h1>{code}</h1>
            <span className={`badge ${deviation.status === "OPEN" ? "open" : "closed"}`}>{deviation.status === "OPEN" ? "Abierta" : "Cerrada"}</span>
            {deviation.classification ? <span className={`badge ${deviation.classification.toLowerCase()}`}>{classificationLabel(deviation.classification)}</span> : null}
            <span className="badge neutral">{deviation.departmentCodeSnapshot ?? deviation.department?.code ?? "Sin departamento"}</span>
            {currentVersion ? <span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          <p className="muted-note">Apertura {formatDate(deviation.issueDate)} · Cumplimentado por {text(deviation.createdByText)}</p>
        </div>
        <div className="record-actions">
          <Link className="button primary" href={`/deviations/${id}/edit`}>Editar</Link>
          <Link className="button" href={`/deviations/${id}?tab=followups#new-followup`}>+ Seguimiento</Link>
          <a className="button" href={`/api/deviations/${id}/annex-iii`}>Generar Anexo III</a>
        </div>
      </div>

      <nav className="record-tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={`/deviations/${id}?tab=${key}`}>{label}</Link>
        ))}
      </nav>

      {activeTab === "summary" ? (
        <>
          <div className="card">
            <h2>Resumen del expediente</h2>
            <dl className="info-grid">
              <div className="info-item"><dt>Material / proceso</dt><dd>{text(deviation.materialProcessAffected)}</dd></div>
              <div className="info-item"><dt>Procedencia</dt><dd>{text(deviation.provenance)}</dd></div>
              <div className="info-item"><dt>Clasificación</dt><dd>{classificationLabel(deviation.classification)}</dd></div>
              <div className="info-item"><dt>En plazo</dt><dd>{deadlineLabel(deviation.deadlineStatus)}</dd></div>
              <div className="info-item full"><dt>Descripción</dt><dd className="prose-value">{text(deviation.whatHappened)}</dd></div>
              <div className="info-item wide"><dt>Causa raíz</dt><dd className="prose-value">{text(deviation.rootCause)}</dd></div>
              <div className="info-item"><dt>Medidas</dt><dd>{measuresLabel(deviation)}</dd></div>
              <div className="info-item"><dt>Recurrencia</dt><dd>{triStateLabel(deviation.recurrentRootCause)}</dd></div>
              <div className="info-item"><dt>Afecta producto terminado</dt><dd>{triStateLabel(deviation.affectsFinishedProduct)}</dd></div>
              <div className="info-item"><dt>Documento firmado</dt><dd>{deviation.signedDocumentAvailable === true ? "Disponible" : deviation.signedDocumentAvailable === false ? "No disponible" : "No informado"}</dd></div>
              <div className="info-item"><dt>Control del dato</dt><dd>{deviation.dataQualityStatus}</dd></div>
              <div className="info-item full"><dt>Observaciones internas</dt><dd className="prose-value">{text(deviation.internalObservations)}</dd></div>
            </dl>
          </div>
          <div className="card">
            <h2>CAPA relacionadas</h2>
            <p className="section-help">
              Cada propuesta se muestra una sola vez. Cuando se registra como CAPA, el mismo bloque pasa a enlazar con el expediente real.
            </p>
            {deviation.capaPlans.length ? (
              <div className="linked-record-grid">
                {deviation.capaPlans.map((plan) => {
                  const navigation = capaPlanNavigation(plan);
                  const capaCode =
                    plan.businessCapaCode ??
                    plan.linkedCapaRecord?.businessCode ??
                    (plan.proposalStatus === "PROPOSED" ? "Pendiente" : "—");

                  return (
                    <article className="linked-record-card" key={plan.id}>
                      <div className="linked-record-main">
                        <div className="linked-record-heading">
                          <strong>{plan.actionType === "CORRECTIVE" ? "Correctiva" : "Preventiva"}</strong>
                          <span className="badge neutral">{capaProposalStatusLabel(plan.proposalStatus)}</span>
                        </div>
                        <p>{plan.description}</p>
                        <dl className="linked-record-meta">
                          <div><dt>Responsable</dt><dd>{text(plan.responsible)}</dd></div>
                          <div><dt>Fecha prevista</dt><dd>{formatDate(plan.plannedExecutionDate)}</dd></div>
                          <div><dt>Código CAPA</dt><dd>{capaCode}</dd></div>
                        </dl>
                      </div>
                      <div className="linked-record-action">
                        {navigation.kind === "OPEN" ? (
                          <Link className="button small" href={qmsRecordHref("CAPA", navigation.recordId)}>Abrir CAPA</Link>
                        ) : navigation.kind === "CREATE" ? (
                          <Link className="button small primary" href={`/capa/new?fromDeviationPlanId=${plan.id}`}>Crear CAPA</Link>
                        ) : (
                          <span className="muted-note">
                            {plan.proposalStatus === "CANCELLED" ? "Propuesta cancelada" : "Vínculo CAPA no disponible"}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <div className="empty-panel">No hay CAPA propuestas.</div>}
          </div>
        </>
      ) : null}

      {activeTab === "investigation" ? (
        <>
          <div className="card">
            <h2>Investigación</h2>
            <dl className="info-grid">
              <div className="info-item full"><dt>Investigación realizada</dt><dd className="prose-value">{text(deviation.investigation)}</dd></div>
              <div className="info-item"><dt>Concluyente</dt><dd>{triStateLabel(deviation.investigationConclusive)}</dd></div>
              <div className="info-item wide"><dt>Metodología</dt><dd>{deviation.investigationMethods.length ? deviation.investigationMethods.join(", ") : "—"}</dd></div>
              <div className="info-item full"><dt>Causa raíz</dt><dd className="prose-value">{text(deviation.rootCause)}</dd></div>
              <div className="info-item"><dt>Recurrente</dt><dd>{triStateLabel(deviation.recurrentRootCause)}</dd></div>
              <div className="info-item wide"><dt>Antecedentes</dt><dd className="prose-value">{text(deviation.recurrenceDetails)}</dd></div>
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
            {deviation.immediateActions.length ? <div className="timeline">{deviation.immediateActions.map((action)=><div className="timeline-item" key={action.id}><p>{action.description}</p><small className="muted-note">Ejecutada por {text(action.executedBy)} · {formatDate(action.executedAt)}</small></div>)}</div> : <div className="empty-panel">No se han registrado acciones inmediatas.</div>}
          </div>
          <div className="card">
            <h2>CAPA propuestas</h2>
            {deviation.capaPlans.length ? <div className="timeline">{deviation.capaPlans.map((plan)=><div className="timeline-item" key={plan.id}><header><strong>{plan.actionType === "CORRECTIVE" ? "Acción correctiva" : "Acción preventiva"}</strong></header><p>{plan.description}</p><small className="muted-note">Responsable {text(plan.responsible)} · Prevista {formatDate(plan.plannedExecutionDate)}</small></div>)}</div> : <div className="empty-panel">No se han definido CAPA.</div>}
          </div>
          <div className="card"><h2>Conclusión y disposición</h2><dl className="info-grid"><div className="info-item full"><dt>Conclusión/cierre</dt><dd className="prose-value">{text(deviation.conclusion)}</dd></div><div className="info-item"><dt>Disposición</dt><dd>{text(deviation.disposition)}</dd></div><div className="info-item"><dt>Cantidad</dt><dd>{text(deviation.dispositionQuantity)}</dd></div><div className="info-item"><dt>Notificación cliente</dt><dd>{triStateLabel(deviation.clientNotification)}</dd></div><div className="info-item full"><dt>Comentarios disposición</dt><dd className="prose-value">{text(deviation.dispositionComments)}</dd></div></dl></div>
        </>
      ) : null}

      {activeTab === "followups" ? (
        <>
          <div className="card">
            <h2>Histórico de seguimientos</h2>
            {deviation.followups.length ? <div className="timeline">{deviation.followups.map((followup)=><div className="timeline-item" key={followup.id}><header><strong>{formatDate(followup.followupDate)}</strong><span>{followup.followupType ?? "Seguimiento"}</span><span className="muted-note">{followup.completedByText}</span></header><p>{followup.comment}</p><small className="muted-note">Próxima fecha: {formatDate(followup.nextFollowupDate)} · Evidencia: {text(followup.evidenceReference)}</small></div>)}</div> : <div className="empty-panel">Todavía no hay seguimientos.</div>}
          </div>
          <div className="card" id="new-followup">
            <h2>Añadir seguimiento</h2>
            <BasicFollowupForm action={addDeviationFollowupAction.bind(null, id)} defaultActor={deviation.createdByText ?? ""} includeType />
          </div>
        </>
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
          />
        </div>
      ) : null}

      {activeTab === "versions" ? (
        <div className="card">
          <div className="section-title-row">
            <div>
              <h2>Versiones del expediente</h2>
              <p className="muted-note">
                Una edición normal actualiza la versión vigente. Solo una reapertura crea una nueva versión funcional.
              </p>
            </div>
            {currentVersion ? <span className="badge neutral">Actual {versionLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          {deviation.qmsRecord.versions.length ? (
            <div className="timeline">
              {deviation.qmsRecord.versions.map((item) => {
                const summary = recordVersionSummary("DEVIATION", item.snapshot);
                const kind =
                  item.kind === "REOPENING"
                    ? "Reapertura"
                    : item.kind === "HISTORICAL_STATE"
                      ? "Baseline histórico"
                      : "Versión inicial";
                return (
                  <article className="timeline-item" key={item.id}>
                    <header>
                      <strong>{versionLabel(item.sequenceNumber)} · {kind}</strong>
                      <span className={`badge ${summary.status === "OPEN" ? "open" : "closed"}`}>
                        {summary.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </span>
                      {item.frozenAt ? <span className="badge neutral">Histórica</span> : <span className="badge neutral">Vigente</span>}
                    </header>
                    <p>
                      Fecha de cierre de esta versión: {formatDate(summary.closedAt)}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </p>
                    <small className="muted-note">
                      Registrada {formatDate(item.createdAt)} · {item.createdByText ?? "Sistema"}
                    </small>
                    <div className="document-actions">
                      <a className="button small" href={`/api/deviations/${id}/annex-iii?version=${item.sequenceNumber}`}>
                        Descargar Anexo III {versionLabel(item.sequenceNumber)}
                      </a>
                    </div>
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
        <div className="card">
          <h2>Documentos</h2>
          <dl className="info-grid">
            <div className="info-item"><dt>Versión formulario</dt><dd>{deviation.formVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item"><dt>Plantilla Anexo III</dt><dd>{deviation.anexoIIITemplateVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item"><dt>Documento firmado</dt><dd>{deviation.signedDocumentAvailable === true ? "Disponible" : deviation.signedDocumentAvailable === false ? "No disponible" : "No informado"}</dd></div>
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
                  <div className="timeline-item" key={document.id}>
                    <strong>{document.documentType}</strong>
                    <small className="muted-note"> · {formatDate(document.generatedAt)} · {document.generatedByText ?? "Usuario no informado"}</small>
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
          {deviation.qmsRecord.history.length ? <div className="timeline">{deviation.qmsRecord.history.map((event)=><div className="timeline-item" key={event.id}><header><strong>{formatDate(event.changedAt)}</strong><span>{event.changedByText ?? "Sistema"}</span><span className="badge neutral">{event.source}</span></header><p><strong>{event.fieldPath}</strong>{event.reason ? ` · Motivo: ${event.reason}` : ""}</p></div>)}</div> : <div className="empty-panel">Sin modificaciones registradas.</div>}
        </div>
      ) : null}
    </section>
  );
}
