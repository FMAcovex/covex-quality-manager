import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addChangeControlFollowupAction,
  addChangeControlRelationAction,
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
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";

export const dynamic = "force-dynamic";

function relationLabel(type: string) {
  if (type === "GENERATES") return "Genera";
  if (type === "IMPLEMENTED_BY") return "Implantado por";
  if (type === "ASSOCIATED_WITH") return "Asociado";
  return "Relacionado";
}

export default async function ChangeControlDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; relationError?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, relationError } = await searchParams;
  const activeTab = changeControlDetailTabs.some(([key]) => key === rawTab) ? rawTab! : "information";
  const [record, lookups] = await Promise.all([
    getChangeControlDetail(id),
    getChangeControlLookups(),
  ]);
  if (!record) notFound();

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

  return (
    <section className="workspace">
      <div className="record-header">
        <div>
          <p className="eyebrow"><Link href="/changes">← Controles de Cambios</Link></p>
          <div className="record-title-line">
            <h1>{qmsRecordDisplayCode(record.qmsRecord, "Control de Cambio sin código")}</h1>
            <span className="badge neutral">{classificationLabel(record.classification)}</span>
            <span className={`badge ${record.executionStatus === "EXECUTED" ? "closed" : "warning"}`}>
              {executionStatusLabel(record.executionStatus)}
            </span>
            <span className={`badge ${record.effectivenessStatus === "ACCEPTABLE" ? "closed" : record.effectivenessStatus === "NOT_ACCEPTABLE" ? "major" : record.effectivenessStatus === "NOT_APPLICABLE" ? "neutral" : "warning"}`}>
              Eficacia {effectivenessStatusLabel(record.effectivenessStatus)}
            </span>
            <span className={`badge ${record.finalStatus === "CLOSED" ? "closed" : record.finalStatus === "DRAFT" ? "neutral" : "open"}`}>
              {finalStatusLabel(record.finalStatus)}
            </span>
            <span className={`badge ${functionalStatusTone(record)}`}>
              {functionalStatusLabel(record)}
            </span>
            {currentVersion ? <span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          <p className="muted-note">
            Solicitud {formatDate(record.requestDate)} · {record.departmentCodeSnapshot ?? "Sin departamento"} · Dictamen {dictamenResultLabel(record.dictamenResult)}
          </p>
        </div>
        <div className="record-actions">
          <Link className="button primary" href={`/changes/${id}/edit`}>Editar Solicitud / Dictamen</Link>
          {record.dictamenResult === "APPROVED" && record.finalStatus === "OPEN" ? (
            <Link className="button" href={`/changes/${id}?tab=followups#new-followup`}>+ Seguimiento</Link>
          ) : null}
        </div>
      </div>

      {record.finalStatus === "DRAFT" ? (
        <div className="analytics-note">
          <strong>Borrador:</strong> este expediente todavía no es un Control de Cambio operativo. Completa los campos obligatorios y cambia el estado a Abierto para iniciar su ciclo formal.
        </div>
      ) : null}

      <QmsAdministrativeStatus
        qmsRecordId={record.qmsRecord.id}
        isActive={record.qmsRecord.isActive}
        code={qmsRecordDisplayCode(record.qmsRecord)}
        annulledAt={record.qmsRecord.annulledAt?.toISOString() ?? null}
        annulledByText={record.qmsRecord.annulledByText}
        annulledReason={record.qmsRecord.annulledReason}
        defaultActor={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
      />

      <nav className="record-tabs">
        {changeControlDetailTabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={`/changes/${id}?tab=${key}`}>
            {label}
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
            <span className={`badge ${functionalStatusTone(record)}`}>{functionalStatusLabel(record)}</span>
          </div>
          <section className="change-overview-description">
            <h3>Descripción del cambio</h3>
            <p>{displayValue(record.description)}</p>
          </section>
          <dl className="change-overview-meta">
            <div className="info-item"><dt>Código</dt><dd>{record.qmsRecord.businessCode ?? "—"}</dd></div>
            <div className="info-item"><dt>Departamento</dt><dd>{department}</dd></div>
            <div className="info-item"><dt>Clasificación</dt><dd><span className="badge neutral">{classificationLabel(record.classification)}</span></dd></div>
          </dl>
          <dl className="change-date-pair">
            <div>
              <dt>Fecha de solicitud</dt>
              <dd>{formatDate(record.requestDate)}</dd>
            </div>
            <div>
              <dt>Fecha prevista de implementación</dt>
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
              <div className="info-item"><dt>Solicitante</dt><dd>{displayValue(record.requesterName)}</dd></div>
              <div className="info-item"><dt>Cargo / puesto</dt><dd>{displayValue(record.requesterPosition)}</dd></div>
              <div className="info-item"><dt>Departamento</dt><dd>{department}</dd></div>
              <div className="info-item"><dt>Fecha de solicitud</dt><dd>{formatDate(record.requestDate)}</dd></div>
              <div className="info-item full"><dt>Ámbito del cambio</dt><dd>{scope}{record.otherScope ? ` · ${record.otherScope}` : ""}</dd></div>
            </dl>
          </section>
          <section className="change-prose-section">
            <h3>Descripción del cambio</h3>
            <p>{displayValue(record.description)}</p>
          </section>
          <section className="change-prose-section">
            <h3>Justificación del cambio</h3>
            <p>{displayValue(record.justification)}</p>
          </section>
          <section className="change-prose-section">
            <h3>Documentos aportados</h3>
            <p>{displayValue(record.providedDocuments)}</p>
          </section>
          <section className="change-decision-panel">
            <div className="change-decision-heading">
              <div><p className="eyebrow">Decisión</p><h3>Decisión de la solicitud</h3></div>
              <span className={`badge ${requestDecisionTone(record.requestDecision)}`}>{requestDecisionLabel(record.requestDecision)}</span>
            </div>
            <dl className="info-grid">
              <div className="info-item"><dt>Responsable de dictamen</dt><dd>{displayValue(record.requestDecisionResponsible)}</dd></div>
              <div className="info-item"><dt>Cargo / función</dt><dd>{displayValue(record.requestDecisionRole)}</dd></div>
              <div className="info-item"><dt>Fecha de aceptación/denegación</dt><dd>{formatDate(record.requestDecisionDate)}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}

      {activeTab === "dictamen" ? (
        <>
          <div className="card change-dictamen-result">
            <div>
              <p className="eyebrow">Anexo IV</p>
              <h2>Resultado del dictamen</h2>
              <span className={`badge ${dictamenResultTone(record.dictamenResult)}`}>{dictamenResultLabel(record.dictamenResult)}</span>
            </div>
            <dl>
              <div><dt>Fecha del dictamen</dt><dd>{formatDate(record.dictamenDate)}</dd></div>
              <div><dt>Clasificación</dt><dd>{classificationLabel(record.classification)}</dd></div>
            </dl>
          </div>

          <div className="card change-evaluation-card">
            <h2>Evaluación del cambio</h2>
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
                <div className="change-requirement-row" role="row" key={item.question}>
                  <div role="cell"><span className="change-mobile-label">Requisito</span><strong>{item.question}</strong></div>
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
                    <tr key={item.id} className={item.origin === "FOLLOWUP" ? "followup-new-task" : ""}>
                      <td>{item.origin === "FOLLOWUP" ? <span className="badge new-task">NUEVA S{String(item.introducedInFollowup ?? 0).padStart(2,"0")}</span> : <span className="badge neutral">DICTAMEN</span>}</td>
                      <td>{item.departmentCodeSnapshot ?? "—"}</td>
                      <td className="table-cell-wrap">{item.description}</td>
                      <td>{item.responsible ?? "—"}</td>
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
                <div className="info-item wide"><dt>Responsable de seguimiento</dt><dd>{displayValue(record.followupResponsible)}</dd></div>
                <div className="info-item wide"><dt>Fecha del próximo seguimiento</dt><dd>{nextFollowupDate ? formatDate(nextFollowupDate) : "Pendiente de establecer en el seguimiento"}</dd></div>
              </dl>
            </section>
            <section className="change-prose-section">
              <h2>Observaciones</h2>
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
                {record.followups.map((item) => (
                  <article className="timeline-item" key={item.id}>
                    <div className="timeline-marker">{String(item.sequenceNumber).padStart(2,"0")}</div>
                    <div>
                      <header>
                        <strong>Seguimiento {String(item.sequenceNumber).padStart(2,"0")} · {formatDate(item.followupDate)}</strong>
                        <span className={`badge ${item.executionStatus === "EXECUTED" ? "closed" : "warning"}`}>{executionStatusLabel(item.executionStatus)}</span>
                        <span className={`badge ${item.effectivenessStatus === "ACCEPTABLE" ? "closed" : item.effectivenessStatus === "NOT_ACCEPTABLE" ? "major" : item.effectivenessStatus === "NOT_APPLICABLE" ? "neutral" : "warning"}`}>{effectivenessStatusLabel(item.effectivenessStatus)}</span>
                      </header>
                      <p>Responsable: {item.responsible} · Próximo: {formatDate(item.nextFollowupDate)}</p>
                      {item.remainOpenReason ? <p><strong>Motivo abierto:</strong> {item.remainOpenReason}</p> : null}
                      {item.conclusion ? <p><strong>Conclusión:</strong> {item.conclusion}</p> : null}
                      <div className="document-actions">
                        <a className="button small" href={`/api/changes/${id}/annex-v?version=${item.sequenceNumber}`}>
                          Descargar Anexo V · {String(item.sequenceNumber).padStart(2,"0")}
                        </a>
                      </div>
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
                ))}
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
              <ChangeFollowupForm
                action={addChangeControlFollowupAction.bind(null, id)}
                departments={lookups.departments}
                tasks={followupTasks}
                defaultResponsible={record.followupResponsible}
              />
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
                {record.annexIIITemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${record.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a> : <span className="muted-note">Plantilla pendiente de cargar.</span>}
                <a className="button primary" href={documentUrls.annexIII}>Generar Anexo III</a>
              </div>
            </div>
            <div className="document-block">
              <div className="change-document-heading"><h3>Anexo IV · Dictamen</h3><span className="badge neutral">{record.annexIVTemplateVersion?.versionCode ?? "Sin plantilla"}</span></div>
              <p>Plantilla oficial y Dictamen cumplimentado.</p>
              <div className="document-actions">
                {record.annexIVTemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${record.annexIVTemplateVersion.id}/download`}>Descargar plantilla oficial</a> : <span className="muted-note">Plantilla pendiente de cargar.</span>}
                <a className="button primary" href={documentUrls.annexIV}>Generar Anexo IV</a>
              </div>
            </div>
            <div className="document-block">
              <div className="change-document-heading"><h3>Anexo V · Seguimiento</h3><span className="badge neutral">{record.annexVTemplateVersion?.versionCode ?? "Sin plantilla"}</span></div>
              <p>Cada seguimiento se genera con su versión histórica correspondiente.</p>
              <div className="document-actions">
                {record.annexVTemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${record.annexVTemplateVersion.id}/download`}>Descargar plantilla oficial</a> : null}
                {currentVersion ? <a className="button primary" href={changeControlVersionDocumentUrls(id, currentVersion.sequenceNumber).annexV}>Generar Anexo V · {versionLabel(currentVersion.sequenceNumber)}</a> : <span className="badge neutral">Disponible tras Seguimiento 00</span>}
              </div>
            </div>
            <div className="document-block">
              <div className="change-document-heading"><h3>Anexo VII · Listado maestro</h3><span className="badge neutral">Anual</span></div>
              <p>Listado oficial anual de Controles de Cambios.</p>
              <Link className="button" href={documentUrls.annexVII}>Ir al listado y descargar Anexo VII</Link>
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
                        <a className="button small" href={urls.annexV}>
                          Descargar Anexo V histórico
                        </a>
                        <a className="button small" href={urls.annexIII}>
                          Solicitud en esta versión
                        </a>
                        <a className="button small" href={urls.annexIV}>
                          Dictamen en esta versión
                        </a>
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
          {relationError ? <p className="form-error">{relationError}</p> : null}
          <form action={addChangeControlRelationAction.bind(null, id)} className="relation-form inline-form">
            <label className="field"><span>Codificación relacionada</span><input name="businessCode" required /></label>
            <label className="field"><span>Tipo de relación</span><select name="relationType"><option value="RELATED_TO">Relacionada</option><option value="GENERATES">Genera</option><option value="IMPLEMENTED_BY">Implantada por</option><option value="ASSOCIATED_WITH">Asociada</option></select></label>
            <label className="field"><span>Registrado por</span><input name="actor" defaultValue={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"} /></label>
            <div className="full"><button className="button primary" type="submit">Añadir relación</button></div>
          </form>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="card">
          <h2>Historial interno de modificaciones</h2>
          <p className="muted-note">Historial operativo. Las versiones formales de seguimiento se conservan por separado.</p>
          {record.qmsRecord.history.length ? (
            <div className="timeline">
              {record.qmsRecord.history.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <div>
                    <header><strong>{formatDate(item.changedAt)}</strong><span>{item.changedByText ?? "Sistema"}</span><span className="badge neutral">{item.source}</span></header>
                    <p><strong>{item.fieldPath}</strong>{item.reason ? ` · Motivo: ${item.reason}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty-panel">Sin modificaciones registradas.</div>}
        </div>
      ) : null}
    </section>
  );
}
