import Link from "next/link";
import { notFound } from "next/navigation";
import { addCapaFollowupAction, addCapaRelationAction } from "@/modules/capa/actions";
import {
  capaStatusLabel,
  capaTypeLabel,
  effectivenessLabel,
  formatDate,
} from "@/modules/capa/domain";
import { getCapaDetail } from "@/modules/capa/queries";
import { recordVersionSummary, versionLabel } from "@/lib/qms/versioning";
import { qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { CapaFollowupForm } from "@/modules/capa/components/capa-followup-form";
import {
  nextCapaFollowupSequence,
  resolveCapaFollowupVersion,
} from "@/modules/capa/followup-version-ui";
import { OperationalRelationForm } from "@/components/operational-relation-form";

import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";

export const dynamic = "force-dynamic";

const tabs = [
  ["summary", "Resumen"],
  ["actions", "Acciones"],
  ["followups", "Seguimientos"],
  ["effectiveness", "Eficacia"],
  ["relations", "Relaciones"],
  ["versions", "Versiones"],
  ["documents", "Documentos"],
  ["history", "Historial"],
] as const;

function originRelationLabel(recordType: string) {
  if (recordType === "DEVIATION") return "Desviación de origen";
  if (recordType === "COMPLAINT") return "Reclamación de origen";
  return "Expediente de origen";
}

export default async function CapaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const activeTab = tabs.some(([key]) => key === rawTab) ? rawTab! : "summary";
  const capa = await getCapaDetail(id);
  if (!capa) notFound();

  const currentVersion = capa.qmsRecord.versions.at(-1) ?? null;
  const nextFollowupSequence = nextCapaFollowupSequence(capa.followups);

  const origins = capa.qmsRecord.targetRelations
    .filter(
      (item) =>
        item.relationType === "GENERATES" &&
        (item.sourceRecord.recordType === "DEVIATION" ||
          item.sourceRecord.recordType === "COMPLAINT"),
    )
    .map((item) => item.sourceRecord);
  const primaryOrigin = origins.length === 1 ? origins[0] : null;

  return (
    <section className="workspace">
      <div className="record-header">
        <div>
          <p className="eyebrow"><Link href="/capa">← CAPA</Link></p>
          <div className="record-title-line">
            <h1>{qmsRecordDisplayCode(capa.qmsRecord, "CAPA sin código")}</h1>
            <span className="badge neutral">{capaTypeLabel(capa.actionType)}</span>
            <span className={`badge ${capa.status === "OPEN" ? "open" : capa.status === "CLOSED" ? "closed" : "neutral"}`}>
              {capaStatusLabel(capa.status)}
            </span>
            <span className="badge neutral">{capa.departmentCodeSnapshot ?? "Sin departamento"}</span>
            {currentVersion ? <span className="badge neutral">{versionLabel(currentVersion.sequenceNumber)}</span> : null}
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
          <Link className="button primary" href={`/capa/${id}/edit`}>Editar</Link>
          <Link className="button" href={`/capa/${id}?tab=followups#new-followup`}>+ Seguimiento</Link>
          <a className="button" href={`/api/capa/${id}/annex-iii`}>Generar Anexo III</a>
        </div>
      </div>

      <QmsAdministrativeStatus
        qmsRecordId={capa.qmsRecord.id}
        isActive={capa.qmsRecord.isActive}
        code={qmsRecordDisplayCode(capa.qmsRecord)}
        annulledAt={capa.qmsRecord.annulledAt?.toISOString() ?? null}
        annulledByText={capa.qmsRecord.annulledByText}
        annulledReason={capa.qmsRecord.annulledReason}
        defaultActor={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
      />

      <nav className="record-tabs">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            className={activeTab === key ? "active" : ""}
            href={`/capa/${id}?tab=${key}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === "summary" ? (
        <>
          <div className="card">
            <h2>Resumen del expediente</h2>
            <dl className="info-grid">
              <div className="info-item"><dt>Tipo</dt><dd>{capaTypeLabel(capa.actionType)}</dd></div>
              <div className="info-item"><dt>Departamento</dt><dd>{capa.departmentCodeSnapshot ?? "—"} · {capa.departmentNameSnapshot ?? ""}</dd></div>
              <div className="info-item"><dt>Origen</dt><dd>{capa.originType ?? "—"}</dd></div>
              <div className="info-item">
                <dt>Código origen</dt>
                <dd>
                  {primaryOrigin ? (
                    <Link href={qmsRecordHref(primaryOrigin.recordType, primaryOrigin.id)}>
                      {capa.originCode ?? qmsRecordDisplayCode(primaryOrigin, qmsRecordTypeLabel(primaryOrigin.recordType))}{!primaryOrigin.isActive ? " · Anulado" : ""}
                    </Link>
                  ) : (
                    capa.originCode ?? "—"
                  )}
                </dd>
              </div>
              <div className="info-item full"><dt>Aplica a</dt><dd>{capa.applicableTo ?? "—"}</dd></div>
              <div className="info-item full"><dt>Descripción breve del defecto</dt><dd className="prose-value">{capa.defectDescription ?? "—"}</dd></div>
              <div className="info-item wide"><dt>Causa raíz</dt><dd className="prose-value">{capa.rootCause ?? "—"}</dd></div>
              <div className="info-item wide"><dt>Impacto</dt><dd className="prose-value">{capa.impactAssessment ?? "—"}</dd></div>
              <div className="info-item"><dt>Estado</dt><dd>{capaStatusLabel(capa.status)}</dd></div>
              <div className="info-item"><dt>Cierre operativo</dt><dd>{formatDate(capa.operationalClosedAt)}</dd></div>
              <div className="info-item"><dt>Eficacia</dt><dd>{effectivenessLabel(capa.effectivenessStatus)}</dd></div>
              <div className="info-item"><dt>Cierre efectivo</dt><dd>{formatDate(capa.effectiveClosedAt)}</dd></div>
              <div className="info-item full"><dt>Observaciones internas</dt><dd className="prose-value">{capa.internalObservations ?? "—"}</dd></div>
            </dl>
          </div>
          <div className="card">
            <h2>Expediente de origen</h2>
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
              <div className="empty-panel">No hay una Desviación o Reclamación de origen vinculada.</div>
            )}
          </div>
        </>
      ) : null}

      {activeTab === "actions" ? (
        <div className="card">
          <h2>Acciones propuestas</h2>
          <div className="table-scroll">
            <table className="records-table compact-table">
              <thead>
                <tr><th>#</th><th>Descripción</th><th>Responsable</th><th>Fecha prevista</th><th>Impacto</th></tr>
              </thead>
              <tbody>
                {capa.plannedActions.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td className="table-cell-wrap">{item.description}</td>
                    <td>{item.responsible ?? "—"}</td>
                    <td>{formatDate(item.plannedExecutionDate)}</td>
                    <td className="table-cell-wrap">{item.impact ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "followups" ? (
        <>
          <div className="card">
            <div className="section-title-row">
              <div>
                <h2>Histórico de seguimientos</h2>
                <p className="muted-note">
                  V00 es el informe inicial. Cada seguimiento conserva el estado completo de la CAPA en V01, V02, V03…
                </p>
              </div>
              <span className="badge neutral">
                Actual {currentVersion ? versionLabel(currentVersion.sequenceNumber) : "V00"}
              </span>
            </div>
            {capa.followups.length ? (
              <div className="timeline">
                {capa.followups.map((item) => {
                  const version = resolveCapaFollowupVersion(
                    capa.qmsRecord.versions,
                    item,
                  );
                  const summary = version
                    ? recordVersionSummary("CAPA", version.snapshot)
                    : null;
                  const sequence = version?.sequenceNumber ?? item.sequenceNumber;

                  return (
                    <article className="timeline-item" key={item.id}>
                      <div className="timeline-marker">
                        {String(item.sequenceNumber).padStart(2, "0")}
                      </div>
                      <div>
                        <header>
                          <strong>
                            Seguimiento {String(item.sequenceNumber).padStart(2, "0")}
                            {version ? ` · ${versionLabel(sequence)}` : ""}
                          </strong>
                          <span>{formatDate(item.followupDate)} · {item.completedByText}</span>
                          {summary ? (
                            <>
                              <span className={`badge ${summary.status === "OPEN" ? "open" : summary.status === "CLOSED" ? "closed" : "neutral"}`}>
                                {capaStatusLabel(String(summary.status ?? "OPEN"))}
                              </span>
                              <span className="badge neutral">
                                Eficacia {effectivenessLabel(String(summary.effectivenessStatus ?? "PENDING"))}
                              </span>
                            </>
                          ) : null}
                          {version ? (
                            <span className="badge neutral">
                              {version.frozenAt ? "Histórica" : "Vigente"}
                            </span>
                          ) : null}
                        </header>
                        {item.reason ? <p><strong>Motivo:</strong> {item.reason}</p> : null}
                        <p><strong>Actuación / resultado:</strong> {item.description}</p>
                        {item.evidenceReference ? (
                          <p><strong>Evidencia de ejecución:</strong> {item.evidenceReference}</p>
                        ) : null}
                        {item.observations ? (
                          <p><strong>Observaciones:</strong> {item.observations}</p>
                        ) : null}
                        <p className="muted-note">
                          Próximo seguimiento: {formatDate(item.nextFollowupDate)}
                          {summary ? ` · Cierre operativo: ${formatDate(summary.closedAt)} · Cierre efectivo: ${formatDate(summary.effectiveClosedAt)}` : ""}
                        </p>
                        {version ? (
                          <div className="document-actions">
                            <a
                              className="button small"
                              href={`/api/capa/${id}/annex-iii?version=${sequence}`}
                            >
                              Descargar Anexo III {versionLabel(sequence)}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-panel">
                Todavía no hay seguimientos. El informe inicial corresponde a V00.
              </div>
            )}
          </div>

          <div className="card" id="new-followup">
            <h2>Añadir seguimiento</h2>
            <CapaFollowupForm
              action={addCapaFollowupAction.bind(null, id)}
              defaultActor={capa.createdByText ?? ""}
              nextSequenceNumber={nextFollowupSequence}
              defaults={{
                status: capa.status,
                operationalClosedAt: capa.operationalClosedAt?.toISOString().slice(0, 10) ?? "",
                cancellationReason: capa.cancellationReason ?? "",
                conclusion: capa.conclusion ?? "",
                effectivenessStatus: capa.effectivenessStatus,
                effectivenessCriteria: capa.effectivenessCriteria ?? "",
                effectivenessAssessment: capa.effectivenessAssessment ?? "",
                effectivenessEvidence: capa.effectivenessEvidence ?? "",
                effectiveClosedAt: capa.effectiveClosedAt?.toISOString().slice(0, 10) ?? "",
              }}
            />
          </div>
        </>
      ) : null}

      {activeTab === "effectiveness" ? (
        <div className="card">
          <h2>Eficacia y cierre</h2>
          <dl className="info-grid">
            <div className="info-item"><dt>Estado eficacia</dt><dd>{effectivenessLabel(capa.effectivenessStatus)}</dd></div>
            <div className="info-item"><dt>Fecha cierre operativo</dt><dd>{formatDate(capa.operationalClosedAt)}</dd></div>
            <div className="info-item"><dt>Fecha verificación final</dt><dd>{formatDate(capa.effectiveClosedAt)}</dd></div>
            <div className="info-item full"><dt>Criterio de eficacia</dt><dd className="prose-value">{capa.effectivenessCriteria ?? "—"}</dd></div>
            <div className="info-item full"><dt>Valoración</dt><dd className="prose-value">{capa.effectivenessAssessment ?? "—"}</dd></div>
            <div className="info-item full"><dt>Evidencia</dt><dd className="prose-value">{capa.effectivenessEvidence ?? "—"}</dd></div>
            <div className="info-item full"><dt>Conclusión / cierre</dt><dd className="prose-value">{capa.conclusion ?? "—"}</dd></div>
            {capa.status === "CANCELLED" ? (
              <div className="info-item full"><dt>Motivo cancelación</dt><dd className="prose-value">{capa.cancellationReason ?? "—"}</dd></div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {activeTab === "relations" ? (
        <div className="card">
          <h2>Origen de la CAPA</h2>
          {origins.length ? (
            <div className="relation-list">
              {origins.map((record) => (
                <div className="relation-card" key={record.id}>
                  <span>{originRelationLabel(record.recordType)}</span>
                  <Link href={qmsRecordHref(record.recordType, record.id)}>
                    <strong>{qmsRecordDisplayCode(record, qmsRecordTypeLabel(record.recordType))}{!record.isActive ? " · Anulado" : ""}</strong>
                  </Link>
                  <small>Vista inversa de la relación QMS.</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">No hay una Desviación o Reclamación de origen vinculada.</div>
          )}
          <OperationalRelationForm
            action={addCapaRelationAction.bind(null, id)}
            title="Vincular expediente de origen"
            codeLabel="Codificación de origen"
            codePlaceholder="D/GC-00/001/2026"
            buttonLabel="Vincular origen"
            defaultActor={capa.createdByText ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo"}
            targetOptions={[
              { value: "DEVIATION", label: "Desviación" },
              { value: "COMPLAINT", label: "Reclamación" },
            ]}
          />
        </div>
      ) : null}

      {activeTab === "versions" ? (
        <div className="card">
          <div className="section-title-row">
            <div>
              <h2>Versiones y seguimientos</h2>
              <p className="muted-note">
                V00 corresponde al informe inicial. Cada seguimiento posterior genera V01, V02, V03… y conserva el estado completo de ese momento.
              </p>
            </div>
            {currentVersion ? <span className="badge neutral">Actual {versionLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          {capa.qmsRecord.versions.length ? (
            <div className="timeline">
              {capa.qmsRecord.versions.map((item) => {
                const summary = recordVersionSummary("CAPA", item.snapshot);
                const kind =
                  item.kind === "FOLLOWUP"
                    ? `Seguimiento ${String(item.sequenceNumber).padStart(2, "0")}`
                    : item.kind === "HISTORICAL_STATE"
                      ? "Baseline histórico"
                      : "Informe inicial";
                return (
                  <article className="timeline-item" key={item.id}>
                    <div className="timeline-marker">{String(item.sequenceNumber).padStart(2, "0")}</div>
                    <div>
                      <header>
                        <strong>{versionLabel(item.sequenceNumber)} · {kind}</strong>
                        <span className={`badge ${summary.status === "OPEN" ? "open" : summary.status === "CLOSED" ? "closed" : "neutral"}`}>
                          {capaStatusLabel(String(summary.status ?? "OPEN"))}
                        </span>
                        <span className="badge neutral">Eficacia {effectivenessLabel(String(summary.effectivenessStatus ?? "PENDING"))}</span>
                        {item.frozenAt ? <span className="badge neutral">Histórica</span> : <span className="badge neutral">Vigente</span>}
                      </header>
                      <p>
                        Cierre operativo: {formatDate(summary.closedAt)} · Próximo seguimiento: {formatDate(summary.nextFollowupDate)}
                      </p>
                      <p>
                        Cierre efectivo: {formatDate(summary.effectiveClosedAt)}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </p>
                      <small className="muted-note">
                        Registrada {formatDate(item.createdAt)} · {item.createdByText ?? "Sistema"}
                      </small>
                      <div className="document-actions">
                        <a className="button small" href={`/api/capa/${id}/annex-iii?version=${item.sequenceNumber}`}>
                          Descargar Anexo III {versionLabel(item.sequenceNumber)}
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-panel">
              Este expediente todavía no tiene snapshot persistido. Los históricos anteriores al Hito 6.1 no se reconstruyen artificialmente.
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "documents" ? (
        <div className="card">
          <h2>Documentos</h2>
          <dl className="info-grid">
            <div className="info-item"><dt>Versión formulario</dt><dd>{capa.formVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item"><dt>Plantilla Anexo III</dt><dd>{capa.annexIIITemplateVersion?.versionCode ?? "No asignada"}</dd></div>
            <div className="info-item"><dt>Documento firmado</dt><dd>{capa.signedDocumentAvailable === true ? "Disponible" : capa.signedDocumentAvailable === false ? "No disponible" : "No informado"}</dd></div>
          </dl>
          <div className="document-grid">
            <div className="document-block">
              <h3>Anexo III · Informe CAPA</h3>
              <p>Plantilla oficial y versión Word cumplimentada del informe/seguimiento CAPA.</p>
              <div className="document-actions">
                {capa.annexIIITemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${capa.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a> : <span className="muted-note">Plantilla oficial pendiente de cargar.</span>}
                <a className="button primary" href={`/api/capa/${id}/annex-iii`}>Generar Anexo III cumplimentado</a>
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
                  <div className="timeline-item" key={item.id}>
                    <strong>{item.documentType}</strong>
                    <small className="muted-note"> · {formatDate(item.generatedAt)} · {item.generatedByText ?? "Usuario no informado"}</small>
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
          {capa.qmsRecord.history.length ? (
            <div className="timeline">
              {capa.qmsRecord.history.map((item) => (
                <div className="timeline-item" key={item.id}>
                  <header>
                    <strong>{formatDate(item.changedAt)}</strong>
                    <span>{item.changedByText ?? "Sistema"}</span>
                    <span className="badge neutral">{item.source}</span>
                  </header>
                  <p><strong>{item.fieldPath}</strong>{item.reason ? ` · Motivo: ${item.reason}` : ""}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">Sin modificaciones registradas.</div>
          )}
        </div>
      ) : null}
    </section>
  );
}
