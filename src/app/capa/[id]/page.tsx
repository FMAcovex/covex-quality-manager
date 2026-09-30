import Link from "next/link";
import { notFound } from "next/navigation";
import { addCapaRelationAction, unlinkCapaOriginAction } from "@/modules/capa/actions";
import {
  capaStatusLabel,
  capaTypeLabel,
  effectivenessLabel,
  formatDate,
} from "@/modules/capa/domain";
import { getCapaDetail } from "@/modules/capa/queries";
import { recordVersionSummary } from "@/lib/qms/versioning";
import { qmsRecordHref, qmsRecordTypeLabel, qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { OperationalRelationForm } from "@/components/operational-relation-form";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";

export const dynamic = "force-dynamic";

const tabs = [
  ["summary", "Resumen"],
  ["action-followups", "Seguimiento de la acción"],
  ["state", "Estado y eficacia"],
  ["relations", "Relaciones"],
  ["versions", "Seguimientos"],
  ["documents", "Documentos"],
  ["history", "Historial"],
] as const;

function originRelationLabel(recordType: string) {
  if (recordType === "DEVIATION") return "Desviación de origen";
  if (recordType === "COMPLAINT") return "Reclamación de origen";
  return "Expediente de origen";
}

function followupLabel(sequenceNumber: number) {
  return `Seguimiento ${String(sequenceNumber).padStart(2, "0")}`;
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
  const origins = capa.qmsRecord.targetRelations
    .filter(
      (item) =>
        item.relationType === "GENERATES" &&
        (item.sourceRecord.recordType === "DEVIATION" ||
          item.sourceRecord.recordType === "COMPLAINT"),
    )
    .map((item) => item.sourceRecord);


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
          <Link className="button primary" href={`/capa/${id}/edit`}>Editar / nuevo seguimiento</Link>
          {capa.status !== "DRAFT" ? <a className="button" href={`/api/capa/${id}/annex-iii`}>Generar Anexo III</a> : null}
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
        defaultActor={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"}
      />

      <nav className="record-tabs">
        {tabs.map(([key, label]) => (
          <Link key={key} className={activeTab === key ? "active" : ""} href={`/capa/${id}?tab=${key}`}>
            {label}
          </Link>
        ))}
      </nav>

      {activeTab === "summary" ? (
        <>
          <div className="card">
            <h2>Resumen del expediente</h2>
            <dl className="info-grid">
              <div className="info-item"><dt>Tipo CAPA</dt><dd>{capaTypeLabel(capa.actionType)}</dd></div>
              <div className="info-item"><dt>Departamento</dt><dd>{capa.departmentCodeSnapshot ?? "—"} · {capa.departmentNameSnapshot ?? ""}</dd></div>
              <div className="info-item full"><dt>Materia / material / producto / sistema / equipo</dt><dd>{capa.applicableTo ?? "—"}</dd></div>
              <div className="info-item full"><dt>Descripción breve del defecto</dt><dd className="prose-value">{capa.defectDescription ?? "—"}</dd></div>
              <div className="info-item full"><dt>Causa raíz</dt><dd className="prose-value">{capa.rootCause ?? "—"}</dd></div>
              <div className="info-item full"><dt>Observaciones internas</dt><dd className="prose-value">{capa.internalObservations ?? "—"}</dd></div>
            </dl>
          </div>

          <div className="card">
            <h2>Expediente / origen</h2>
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
                  : "No hay una Desviación o Reclamación de origen vinculada."}
              </div>
            )}
          </div>

          <div className="card">
            <h2>Acciones propuestas</h2>
            {capa.plannedActions.length ? (
              <div className="table-scroll">
                <table className="records-table compact-table">
                  <thead>
                    <tr><th>#</th><th>Descripción</th><th>Responsable</th><th>Fecha prevista</th><th>Impacto</th></tr>
                  </thead>
                  <tbody>
                    {capa.plannedActions.map((item, index) => (
                      <tr key={item.id}>
                        <td>{String(index + 1).padStart(2, "0")}</td>
                        <td className="table-cell-wrap">{item.description}</td>
                        <td>{item.responsible ?? "—"}</td>
                        <td>{formatDate(item.plannedExecutionDate)}</td>
                        <td className="table-cell-wrap">{item.impact ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-panel">No hay acciones propuestas registradas.</div>}
          </div>
        </>
      ) : null}

      {activeTab === "action-followups" ? (
        <div className="card">
          <div className="section-title-row">
            <div>
              <h2>Seguimiento de la acción</h2>
              <p className="muted-note">Contenido operativo de la CAPA. Estas filas no son Seguimientos 00/01/02 del expediente.</p>
            </div>
          </div>
          {capa.actionFollowups.length ? (
            <div className="table-scroll">
              <table className="records-table compact-table">
                <thead><tr><th>#</th><th>Fecha</th><th>Descripción</th></tr></thead>
                <tbody>
                  {capa.actionFollowups.map((item, index) => (
                    <tr key={item.id}>
                      <td>{String(index + 1).padStart(2, "0")}</td>
                      <td>{formatDate(item.followupDate)}</td>
                      <td className="table-cell-wrap">{item.description ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-panel">No hay seguimientos de acción registrados.</div>}
          {capa.actionFollowupObservations ? (
            <div className="info-item full" style={{ marginTop: 16 }}>
              <dt>Observaciones</dt>
              <dd className="prose-value">{capa.actionFollowupObservations}</dd>
            </div>
          ) : null}

        </div>
      ) : null}

      {activeTab === "state" ? (
        <div className="card">
          <h2>Estado y eficacia</h2>
          <div className="state-efficacy-grid">
            <section className="state-efficacy-panel">
              <h3>Estado operativo</h3>
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
                <div className="info-item full"><dt>Evaluación</dt><dd className="prose-value">{capa.effectivenessAssessment ?? "—"}</dd></div>
              </dl>
            </section>
          </div>

          <section className="state-efficacy-panel" style={{ marginTop: 14 }}>
            <h3>Conclusión</h3>
            <dl className="info-grid">
              <div className="info-item full"><dt>Conclusión / cierre</dt><dd className="prose-value">{capa.conclusion ?? "—"}</dd></div>
              <div className="info-item"><dt>Fecha de próximo seguimiento</dt><dd>{formatDate(capa.nextFollowupDate)}</dd></div>
            </dl>
          </section>
        </div>
      ) : null}

      {activeTab === "relations" ? (
        <div className="card">
          <h2>Orígenes de la CAPA</h2>
          {origins.length ? (
            <div className="relation-list">
              {origins.map((record) => (
                <div className="relation-card" key={record.id}>
                  <span>{originRelationLabel(record.recordType)}</span>
                  <Link href={qmsRecordHref(record.recordType, record.id)}>
                    <strong>{qmsRecordDisplayCode(record, qmsRecordTypeLabel(record.recordType))}{!record.isActive ? " · Anulado" : ""}</strong>
                  </Link>
                  <small>Relación QMS canónica.</small>
                  <form action={unlinkCapaOriginAction.bind(null, id, record.id)}>
                    <input type="hidden" name="actor" value={capa.createdByText ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo"} />
                    <button className="button danger small" type="submit">Desvincular</button>
                  </form>
                </div>
              ))}
            </div>
          ) : <div className="empty-panel">No hay orígenes operativos vinculados.</div>}
          {capa.status === "DRAFT" ? (
            <div className="empty-panel">Las relaciones operativas se activan al abrir la CAPA.</div>
          ) : (
            <OperationalRelationForm
              action={addCapaRelationAction.bind(null, id)}
              title="Vincular otro expediente de origen"
              codeLabel="Codificación de origen"
              codePlaceholder="Buscar expediente"
              buttonLabel="Vincular origen"
              defaultActor={capa.createdByText ?? process.env.DEFAULT_ACTOR_NAME ?? "Usuario demo"}
              targetOptions={[
                { value: "DEVIATION", label: "Desviación" },
                { value: "COMPLAINT", label: "Reclamación" },
              ]}
              currentRecordId={capa.qmsRecord.id}
              currentRecordType="CAPA"
            />
          )}
        </div>
      ) : null}

      {activeTab === "versions" ? (
        <div className="card">
          <div className="section-title-row">
            <div>
              <h2>Seguimientos del expediente</h2>
              <p className="muted-note">
                Seguimiento 00 corresponde al registro inicial. Guardar CAPA actualiza el seguimiento vigente; Guardar como nuevo seguimiento crea 01, 02, 03…
              </p>
            </div>
            {currentVersion ? <span className="badge neutral">Actual {followupLabel(currentVersion.sequenceNumber)}</span> : null}
          </div>
          {capa.qmsRecord.versions.length ? (
            <div className="timeline">
              {capa.qmsRecord.versions.map((item) => {
                const summary = recordVersionSummary("CAPA", item.snapshot);
                return (
                  <article className="timeline-item" key={item.id}>
                    <div className="timeline-marker">{String(item.sequenceNumber).padStart(2, "0")}</div>
                    <div>
                      <header>
                        <strong>{followupLabel(item.sequenceNumber)}</strong>
                        <span className={`badge ${summary.status === "OPEN" ? "open" : summary.status === "CLOSED" ? "closed" : "neutral"}`}>
                          {capaStatusLabel(String(summary.status ?? "OPEN"))}
                        </span>
                        <span className="badge neutral">Eficacia {effectivenessLabel(String(summary.effectivenessStatus ?? "PENDING"))}</span>
                        {item.frozenAt ? <span className="badge neutral">Histórico</span> : <span className="badge neutral">Vigente</span>}
                      </header>
                      <p>Próximo seguimiento: {formatDate(summary.nextFollowupDate)} · Cierre y ejecución: {formatDate(summary.closedAt)}</p>
                      <p>Verificación final: {formatDate(summary.effectiveClosedAt)}{item.reason ? ` · Motivo: ${item.reason}` : ""}</p>
                      <small className="muted-note">Registrado {formatDate(item.createdAt)} · {item.createdByText ?? "Sistema"}</small>
                      <div className="document-actions">
                        <a className="button small" href={`/api/capa/${id}/annex-iii?version=${item.sequenceNumber}`}>
                          Descargar Anexo III · {followupLabel(item.sequenceNumber)}
                        </a>
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
            <div className="info-item"><dt>Documento firmado</dt><dd>{capa.signedDocumentAvailable === true ? "Disponible" : capa.signedDocumentAvailable === false ? "No disponible" : "No informado"}</dd></div>
          </dl>
          <div className="document-grid">
            <div className="document-block">
              <h3>Anexo III · Informe CAPA</h3>
              <p>Plantilla oficial y versión Word cumplimentada del informe/seguimiento CAPA.</p>
              <div className="document-actions">
                {capa.annexIIITemplateVersion?.id ? <a className="button" href={`/api/settings/templates/${capa.annexIIITemplateVersion.id}/download`}>Descargar plantilla oficial</a> : <span className="muted-note">Plantilla oficial pendiente de cargar.</span>}
                {capa.status === "DRAFT" ? <span className="muted-note">Disponible al abrir la CAPA.</span> : <a className="button primary" href={`/api/capa/${id}/annex-iii`}>Generar Anexo III cumplimentado</a>}
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
          <p className="muted-note">Historial administrativo de cambios. Los Seguimientos 00/01/02 del expediente se consultan en su pestaña propia.</p>
          {capa.qmsRecord.history.length ? (
            <div className="timeline">
              {capa.qmsRecord.history.map((item) => (
                <div className="timeline-item history-entry" key={item.id}>
                  <header>
                    <strong>{formatDate(item.changedAt)}</strong>
                    <span>{item.changedByText ?? "Sistema"}</span>
                    <span className="badge neutral">{item.source}</span>
                  </header>
                  <p><strong>{item.fieldPath}</strong>{item.reason ? ` · Motivo: ${item.reason}` : ""}</p>
                </div>
              ))}
            </div>
          ) : <div className="empty-panel">Sin modificaciones registradas.</div>}
        </div>
      ) : null}
    </section>
  );
}
