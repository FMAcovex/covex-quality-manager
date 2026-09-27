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

export const dynamic = "force-dynamic";

const tabs = [
  ["summary", "Resumen"],
  ["actions", "Acciones"],
  ["followups", "Seguimientos"],
  ["effectiveness", "Eficacia"],
  ["relations", "Relaciones"],
  ["documents", "Documentos"],
  ["history", "Historial"],
] as const;

function relationLabel(type: string) {
  if (type === "GENERATES") return "Genera";
  if (type === "IMPLEMENTED_BY") return "Implantada por";
  if (type === "ASSOCIATED_WITH") return "Asociada";
  return "Relacionada";
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

  const relations = [
    ...capa.qmsRecord.targetRelations.map((item) => ({
      direction: "Origen",
      type: item.relationType,
      record: item.sourceRecord,
    })),
    ...capa.qmsRecord.sourceRelations.map((item) => ({
      direction: "Destino",
      type: item.relationType,
      record: item.targetRecord,
    })),
  ];

  return (
    <section className="workspace">
      <div className="record-header">
        <div>
          <p className="eyebrow"><Link href="/capa">← CAPA</Link></p>
          <div className="record-title-line">
            <h1>{capa.qmsRecord.businessCode ?? "CAPA sin código"}</h1>
            <span className="badge neutral">{capaTypeLabel(capa.actionType)}</span>
            <span className={`badge ${capa.status === "OPEN" ? "open" : capa.status === "CLOSED" ? "closed" : "neutral"}`}>
              {capaStatusLabel(capa.status)}
            </span>
            <span className="badge neutral">{capa.departmentCodeSnapshot ?? "Sin departamento"}</span>
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
              <div className="info-item"><dt>Código origen</dt><dd>{capa.originCode ?? "—"}</dd></div>
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
            <h2>Trazabilidad con el origen</h2>
            {relations.length ? (
              <div className="relation-list">
                {relations.map((item, index) => (
                  <div className="relation-card" key={`${item.record.id}-${item.type}-${index}`}>
                    <span>{item.direction} · {relationLabel(item.type)}</span>
                    <strong>{item.record.businessCode ?? item.record.id}</strong>
                    <small>{item.record.recordType}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel">No hay expedientes estructurados relacionados.</div>
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
              <h2>Histórico de seguimientos</h2>
              <span className="badge neutral">Versión inicial 00</span>
            </div>
            {capa.followups.length ? (
              <div className="timeline">
                {capa.followups.map((item) => (
                  <article className="timeline-item" key={item.id}>
                    <div className="timeline-marker">{String(item.sequenceNumber).padStart(2, "0")}</div>
                    <div>
                      <header>
                        <strong>{formatDate(item.followupDate)}</strong>
                        <span>{item.completedByText}</span>
                      </header>
                      {item.reason ? <p><strong>Motivo:</strong> {item.reason}</p> : null}
                      <p>{item.description}</p>
                      {item.observations ? <p><strong>Observaciones:</strong> {item.observations}</p> : null}
                      {item.evidenceReference ? <p><strong>Evidencia:</strong> {item.evidenceReference}</p> : null}
                      <small className="muted-note">Próximo seguimiento: {formatDate(item.nextFollowupDate)}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-panel">Todavía no hay seguimientos. El informe inicial corresponde a la versión 00.</div>
            )}
          </div>

          <div className="card" id="new-followup">
            <h2>Añadir seguimiento</h2>
            <form action={addCapaFollowupAction.bind(null, id)} className="inline-form">
              <label className="field"><span>Fecha *</span><input type="date" name="followupDate" required /></label>
              <label className="field"><span>Cumplimentado por *</span><input name="completedByText" defaultValue={capa.createdByText ?? ""} required /></label>
              <label className="field"><span>Motivo</span><input name="reason" /></label>
              <label className="field full"><span>Actuación realizada / resultado *</span><textarea name="description" required /></label>
              <label className="field"><span>Próxima fecha</span><input type="date" name="nextFollowupDate" /></label>
              <label className="field"><span>Evidencia / referencia</span><input name="evidenceReference" /></label>
              <label className="field full"><span>Observaciones</span><textarea name="observations" /></label>
              <div className="field"><span>&nbsp;</span><button className="button primary" type="submit">Guardar seguimiento</button></div>
            </form>
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
          <h2>Relaciones QMS</h2>
          {relations.length ? (
            <div className="relation-list">
              {relations.map((item, index) => (
                <div className="relation-card" key={`${item.record.id}-${item.type}-${index}`}>
                  <span>{item.direction} · {relationLabel(item.type)}</span>
                  <strong>{item.record.businessCode ?? item.record.id}</strong>
                  <small>{item.record.recordType}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">No hay otros expedientes estructurados relacionados.</div>
          )}
          <form action={addCapaRelationAction.bind(null, id)} className="inline-form relation-form">
            <label className="field"><span>Código expediente</span><input name="relatedCode" placeholder="D/GC-00/001/2026" required /></label>
            <label className="field">
              <span>Relación</span>
              <select name="relationType">
                <option value="RELATED_TO">Relacionada con</option>
                <option value="GENERATES">Genera</option>
                <option value="IMPLEMENTED_BY">Implementada por</option>
                <option value="ASSOCIATED_WITH">Asociada con</option>
              </select>
            </label>
            <label className="field"><span>Registrado por</span><input name="createdByText" defaultValue={capa.createdByText ?? ""} /></label>
            <div className="full"><button className="button" type="submit">Añadir relación</button></div>
          </form>
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
          <div className="document-actions">
            <a className="button primary" href={`/api/capa/${id}/annex-iii`}>Descargar Anexo III cumplimentado</a>
            <span className="muted-note">Cada generación queda registrada en el expediente.</span>
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
