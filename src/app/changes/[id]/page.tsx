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
  requestDecisionLabel,
  scopeLabels,
} from "@/modules/change-control/domain";
import {
  getChangeControlDetail,
  getChangeControlLookups,
} from "@/modules/change-control/queries";
import { recordVersionSummary, versionLabel } from "@/lib/qms/versioning";
import { qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";

export const dynamic = "force-dynamic";

const tabs = [
  ["request", "Solicitud"],
  ["dictamen", "Dictamen"],
  ["followups", "Seguimientos"],
  ["documents", "Documentos"],
  ["relations", "Relaciones"],
  ["history", "Historial"],
] as const;

function relationLabel(type: string) {
  if (type === "GENERATES") return "Genera";
  if (type === "IMPLEMENTED_BY") return "Implantado por";
  if (type === "ASSOCIATED_WITH") return "Asociado";
  return "Relacionado";
}

function triState(value: string | null | undefined) {
  if (value === "YES") return "Sí";
  if (value === "NO") return "No";
  if (value === "NA") return "No aplica";
  return "—";
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
  const activeTab = tabs.some(([key]) => key === rawTab) ? rawTab! : "request";
  const [record, lookups] = await Promise.all([
    getChangeControlDetail(id),
    getChangeControlLookups(),
  ]);
  if (!record) notFound();

  const currentVersion = record.qmsRecord.versions.at(-1) ?? null;
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
            <h1>{record.qmsRecord.businessCode ?? "Control de Cambio sin código"}</h1>
            <span className="badge neutral">{classificationLabel(record.classification)}</span>
            <span className={`badge ${record.executionStatus === "EXECUTED" ? "closed" : "warning"}`}>
              {executionStatusLabel(record.executionStatus)}
            </span>
            <span className={`badge ${record.effectivenessStatus === "ACCEPTABLE" ? "closed" : record.effectivenessStatus === "NOT_ACCEPTABLE" ? "major" : record.effectivenessStatus === "NOT_APPLICABLE" ? "neutral" : "warning"}`}>
              Eficacia {effectivenessStatusLabel(record.effectivenessStatus)}
            </span>
            <span className={`badge ${record.finalStatus === "CLOSED" ? "closed" : "open"}`}>
              {finalStatusLabel(record.finalStatus)}
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

      <nav className="record-tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={`/changes/${id}?tab=${key}`}>
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === "request" ? (
        <div className="card">
          <h2>Solicitud de cambio · Anexo III</h2>
          <dl className="info-grid">
            <div className="info-item"><dt>N.º Control de Cambio</dt><dd>{record.qmsRecord.businessCode ?? "—"}</dd></div>
            <div className="info-item"><dt>Fecha solicitud</dt><dd>{formatDate(record.requestDate)}</dd></div>
            <div className="info-item"><dt>Departamento / Área</dt><dd>{record.departmentCodeSnapshot ?? "—"} · {record.departmentNameSnapshot ?? ""}</dd></div>
            <div className="info-item"><dt>Solicitud</dt><dd>{requestDecisionLabel(record.requestDecision)}</dd></div>
            <div className="info-item full"><dt>Alcance</dt><dd>{record.scope.map((item) => scopeLabels[item] ?? item).join(" · ") || "—"}{record.otherScope ? ` · ${record.otherScope}` : ""}</dd></div>
            <div className="info-item"><dt>Solicitante</dt><dd>{record.requesterName ?? "—"}</dd></div>
            <div className="info-item"><dt>Puesto</dt><dd>{record.requesterPosition ?? "—"}</dd></div>
            <div className="info-item"><dt>Responsable aceptación</dt><dd>{record.requestDecisionResponsible ?? "—"}</dd></div>
            <div className="info-item"><dt>Fecha aceptación</dt><dd>{formatDate(record.requestDecisionDate)}</dd></div>
            <div className="info-item full"><dt>Descripción del cambio</dt><dd className="prose-value">{record.description ?? "—"}</dd></div>
            <div className="info-item full"><dt>Justificación</dt><dd className="prose-value">{record.justification ?? "—"}</dd></div>
            <div className="info-item full"><dt>Documentos aportados</dt><dd className="prose-value">{record.providedDocuments ?? "—"}</dd></div>
          </dl>
        </div>
      ) : null}

      {activeTab === "dictamen" ? (
        <>
          <div className="card">
            <div className="section-title-row">
              <div><h2>Dictamen del cambio · Anexo IV</h2><p className="muted-note">El plan aprobado constituye la línea base del cambio.</p></div>
              <span className={`badge ${record.dictamenResult === "APPROVED" ? "closed" : record.dictamenResult === "REJECTED" ? "major" : "warning"}`}>{dictamenResultLabel(record.dictamenResult)}</span>
            </div>
            <dl className="info-grid">
              <div className="info-item full"><dt>Evaluación</dt><dd className="prose-value">{record.evaluation ?? "—"}</dd></div>
              <div className="info-item"><dt>Clasificación</dt><dd>{classificationLabel(record.classification)}</dd></div>
              <div className="info-item"><dt>Fecha prevista implantación</dt><dd>{formatDate(record.plannedImplementationDate)}</dd></div>
              <div className="info-item"><dt>Fecha aprobación</dt><dd>{formatDate(record.dictamenDate)}</dd></div>
              <div className="info-item"><dt>Responsable seguimiento</dt><dd>{record.followupResponsible ?? "—"}</dd></div>
              <div className="info-item"><dt>Comité de cambios</dt><dd>{record.committeeRequired === null ? "—" : record.committeeRequired ? "Sí" : "No"}</dd></div>
              <div className="info-item"><dt>Informar a cliente</dt><dd>{record.clientNotificationRequired === null ? "—" : record.clientNotificationRequired ? "Sí" : "No"}</dd></div>
              <div className="info-item"><dt>Autoridad sanitaria</dt><dd>{record.authorityRequired === null ? "—" : record.authorityRequired ? "Sí" : "No"}</dd></div>
              <div className="info-item"><dt>PQR</dt><dd>{triState(record.pqrRequired)}</dd></div>
              <div className="info-item"><dt>Estabilidad</dt><dd>{triState(record.stabilityRequired)}</dd></div>
              <div className="info-item"><dt>Análisis adicionales</dt><dd>{triState(record.additionalAnalysisRequired)}</dd></div>
              <div className="info-item"><dt>Validación adicional</dt><dd>{triState(record.additionalValidationRequired)}</dd></div>
              <div className="info-item full"><dt>Observaciones</dt><dd className="prose-value">{record.dictamenObservations ?? "—"}</dd></div>
            </dl>
          </div>
          <div className="card">
            <h2>Plan de ejecución aprobado</h2>
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
        </>
      ) : null}

      {activeTab === "followups" ? (
        <>
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
        <div className="card">
          <h2>Documentos del expediente</h2>
          <p className="muted-note">Solicitud (Anexo III), Dictamen (Anexo IV), Seguimientos (Anexo V) y listado maestro anual (Anexo VII) son familias documentales independientes.</p>
          <div className="document-grid">
            <div className="document-block">
              <h3>Anexo III · Solicitud</h3>
              <p>Plantilla oficial y solicitud cumplimentada del Control de Cambio.</p>
              <div className="document-actions">
                {record.annexIIITemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${record.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a> : <span className="muted-note">Plantilla pendiente de cargar.</span>}
                <a className="button primary" href={`/api/changes/${id}/annex-iii`}>Generar Anexo III cumplimentado</a>
              </div>
            </div>
            <div className="document-block">
              <h3>Anexo IV · Dictamen</h3>
              <p>Plantilla oficial y Dictamen cumplimentado.</p>
              <div className="document-actions">
                {record.annexIVTemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${record.annexIVTemplateVersion.id}/download`}>Descargar plantilla oficial</a> : <span className="muted-note">Plantilla pendiente de cargar.</span>}
                <a className="button primary" href={`/api/changes/${id}/annex-iv`}>Generar Anexo IV cumplimentado</a>
              </div>
            </div>
            <div className="document-block">
              <h3>Anexo V · Seguimiento</h3>
              <p>Cada seguimiento se genera con su versión histórica correspondiente.</p>
              <div className="document-actions">
                {record.annexVTemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${record.annexVTemplateVersion.id}/download`}>Descargar plantilla oficial</a> : null}
                {currentVersion ? <a className="button primary" href={`/api/changes/${id}/annex-v?version=${currentVersion.sequenceNumber}`}>Generar Anexo V · {versionLabel(currentVersion.sequenceNumber)}</a> : <span className="badge neutral">Disponible tras Seguimiento 00</span>}
              </div>
            </div>
            <div className="document-block">
              <h3>Anexo VII · Listado maestro</h3>
              <p>Listado oficial anual de Controles de Cambios.</p>
              <Link className="button" href="/changes">Ir al listado y descargar Anexo VII</Link>
            </div>
          </div>
          {record.qmsRecord.versions.length ? (
            <div className="timeline">
              {record.qmsRecord.versions.map((version) => (
                <div className="timeline-item" key={version.id}>
                  <div>
                    <strong>{versionLabel(version.sequenceNumber)} · Seguimiento {String(version.sequenceNumber).padStart(2,"0")}</strong>
                    <div className="document-actions">
                      <a className="button small" href={`/api/changes/${id}/annex-v?version=${version.sequenceNumber}`}>
                        Descargar Anexo V histórico
                      </a>
                      <a className="button small" href={`/api/changes/${id}/annex-iii?version=${version.sequenceNumber}`}>
                        Solicitud en esta versión
                      </a>
                      <a className="button small" href={`/api/changes/${id}/annex-iv?version=${version.sequenceNumber}`}>
                        Dictamen en esta versión
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {record.qmsRecord.generatedDocuments.length ? (
            <div className="timeline">
              {record.qmsRecord.generatedDocuments.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <div><strong>{item.documentType}</strong><small> · {formatDate(item.generatedAt)} · {item.generatedByText ?? "Usuario no informado"}</small></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">Todavía no se han generado documentos desde la aplicación.</div>
          )}
        </div>
      ) : null}

      {activeTab === "relations" ? (
        <div className="card">
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
