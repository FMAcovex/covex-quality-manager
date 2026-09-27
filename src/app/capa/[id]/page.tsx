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

function relationLabel(type: string) {
  if (type === "GENERATES") return "Genera";
  if (type === "IMPLEMENTED_BY") return "Implantada por";
  if (type === "ASSOCIATED_WITH") return "Asociada";
  return "Relacionada";
}

export default async function CapaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
          <Link href="/capa" className="back-link">← Volver a CAPA</Link>
          <div className="record-title-row">
            <h1>{capa.qmsRecord.businessCode ?? "CAPA sin código"}</h1>
            <span className="badge">{capaTypeLabel(capa.actionType)}</span>
            <span className={`status-badge ${capa.status.toLowerCase()}`}>{capaStatusLabel(capa.status)}</span>
          </div>
          <p>{capa.departmentCodeSnapshot} · apertura {formatDate(capa.openedAt)} · eficacia {effectivenessLabel(capa.effectivenessStatus)}</p>
        </div>
        <div className="record-actions">
          <Link className="button primary" href={`/capa/${id}/edit`}>Editar</Link>
        </div>
      </div>

      <div className="tabs record-tabs">
        <a className="tab active" href="#resumen">Resumen</a>
        <a className="tab" href="#acciones">Acciones</a>
        <a className="tab" href="#seguimientos">Seguimientos</a>
        <a className="tab" href="#eficacia">Eficacia</a>
        <a className="tab" href="#relaciones">Relaciones</a>
        <a className="tab" href="#documentos">Documentos</a>
        <a className="tab" href="#historial">Historial</a>
      </div>

      <section className="detail-section" id="resumen">
        <h2>Resumen</h2>
        <div className="info-grid">
          <div className="info-item"><span>Tipo</span><strong>{capaTypeLabel(capa.actionType)}</strong></div>
          <div className="info-item"><span>Departamento</span><strong>{capa.departmentCodeSnapshot ?? "—"} · {capa.departmentNameSnapshot ?? ""}</strong></div>
          <div className="info-item"><span>Origen</span><strong>{capa.originType ?? "—"}</strong></div>
          <div className="info-item"><span>Código origen</span><strong>{capa.originCode ?? "—"}</strong></div>
          <div className="info-item wide"><span>Aplica a</span><strong>{capa.applicableTo ?? "—"}</strong></div>
          <div className="info-item wide"><span>Descripción breve del defecto</span><p>{capa.defectDescription ?? "—"}</p></div>
          <div className="info-item wide"><span>Causa raíz</span><p>{capa.rootCause ?? "—"}</p></div>
          <div className="info-item wide"><span>Impacto</span><p>{capa.impactAssessment ?? "—"}</p></div>
          <div className="info-item"><span>Estado</span><strong>{capaStatusLabel(capa.status)}</strong></div>
          <div className="info-item"><span>Cierre operativo</span><strong>{formatDate(capa.operationalClosedAt)}</strong></div>
          <div className="info-item"><span>Cierre efectivo</span><strong>{formatDate(capa.effectiveClosedAt)}</strong></div>
          <div className="info-item"><span>Control del dato</span><strong>{capa.dataQualityStatus}</strong></div>
          <div className="info-item wide"><span>Observaciones internas</span><p>{capa.internalObservations ?? "—"}</p></div>
        </div>
      </section>

      <section className="detail-section" id="acciones">
        <h2>Acciones propuestas</h2>
        <div className="table-scroll">
          <table className="records-table compact-table">
            <thead><tr><th>#</th><th>Descripción</th><th>Responsable</th><th>Fecha prevista</th><th>Impacto</th></tr></thead>
            <tbody>
              {capa.plannedActions.map((item, index) => (
                <tr key={item.id}><td>{index+1}</td><td>{item.description}</td><td>{item.responsible ?? "—"}</td><td>{formatDate(item.plannedExecutionDate)}</td><td>{item.impact ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="detail-section" id="seguimientos">
        <div className="section-title-row"><h2>Seguimientos</h2><span className="badge">Versión inicial 00</span></div>
        {capa.followups.length ? (
          <div className="timeline">
            {capa.followups.map((item) => (
              <article className="timeline-item" key={item.id}>
                <div className="timeline-marker">{String(item.sequenceNumber).padStart(2,"0")}</div>
                <div>
                  <strong>{formatDate(item.followupDate)} · {item.completedByText}</strong>
                  {item.reason ? <p><b>Motivo:</b> {item.reason}</p> : null}
                  <p>{item.description}</p>
                  {item.observations ? <p><b>Observaciones:</b> {item.observations}</p> : null}
                  {item.evidenceReference ? <p><b>Evidencia:</b> {item.evidenceReference}</p> : null}
                  <small>Próximo seguimiento: {formatDate(item.nextFollowupDate)}</small>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="empty-panel">Todavía no hay seguimientos. El informe inicial corresponde a la versión 00.</div>}

        <form action={addCapaFollowupAction.bind(null, id)} className="inline-form followup-form">
          <label className="field"><span>Fecha</span><input type="date" name="followupDate" required /></label>
          <label className="field"><span>Cumplimentado por</span><input name="completedByText" defaultValue={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"} required /></label>
          <label className="field"><span>Motivo del seguimiento</span><input name="reason" /></label>
          <label className="field full"><span>Actuación realizada / resultado</span><textarea name="description" required /></label>
          <label className="field"><span>Próxima fecha</span><input type="date" name="nextFollowupDate" /></label>
          <label className="field"><span>Evidencia / referencia</span><input name="evidenceReference" /></label>
          <label className="field full"><span>Observaciones</span><textarea name="observations" /></label>
          <div className="full"><button className="button primary" type="submit">+ Añadir seguimiento</button></div>
        </form>
      </section>

      <section className="detail-section" id="eficacia">
        <h2>Eficacia y cierre</h2>
        <div className="info-grid">
          <div className="info-item"><span>Estado eficacia</span><strong>{effectivenessLabel(capa.effectivenessStatus)}</strong></div>
          <div className="info-item"><span>Fecha cierre operativo</span><strong>{formatDate(capa.operationalClosedAt)}</strong></div>
          <div className="info-item"><span>Fecha verificación final</span><strong>{formatDate(capa.effectiveClosedAt)}</strong></div>
          <div className="info-item wide"><span>Criterio de eficacia</span><p>{capa.effectivenessCriteria ?? "—"}</p></div>
          <div className="info-item wide"><span>Valoración</span><p>{capa.effectivenessAssessment ?? "—"}</p></div>
          <div className="info-item wide"><span>Evidencia</span><p>{capa.effectivenessEvidence ?? "—"}</p></div>
          <div className="info-item wide"><span>Conclusión</span><p>{capa.conclusion ?? "—"}</p></div>
          {capa.status === "CANCELLED" ? <div className="info-item wide"><span>Motivo cancelación</span><p>{capa.cancellationReason ?? "—"}</p></div> : null}
        </div>
      </section>

      <section className="detail-section" id="relaciones">
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
        ) : <div className="empty-panel">No hay otros expedientes estructurados relacionados.</div>}
        <form action={addCapaRelationAction.bind(null,id)} className="inline-form relation-form">
          <label className="field"><span>Código expediente</span><input name="relatedCode" placeholder="D/GC-00/001/2026" required /></label>
          <label className="field"><span>Relación</span><select name="relationType"><option value="RELATED_TO">Relacionada con</option><option value="GENERATES">Genera</option><option value="IMPLEMENTED_BY">Implementada por</option><option value="ASSOCIATED_WITH">Asociada con</option></select></label>
          <label className="field"><span>Registrado por</span><input name="createdByText" defaultValue={process.env.DEFAULT_ACTOR_NAME || "Usuario demo"} /></label>
          <div className="full"><button className="button" type="submit">Añadir relación</button></div>
        </form>
      </section>

      <section className="detail-section" id="documentos">
        <h2>Documentos</h2>
        <div className="empty-panel">La generación del Anexo III CAPA se incorpora en el siguiente bloque del Hito 6.</div>
      </section>

      <section className="detail-section" id="historial">
        <h2>Historial interno de modificaciones</h2>
        {capa.qmsRecord.history.length ? (
          <div className="history-list">
            {capa.qmsRecord.history.map((item) => (
              <div className="history-row" key={item.id}>
                <strong>{formatDate(item.changedAt)} · {item.changedByText ?? "—"}</strong>
                <span>{item.fieldPath}</span>
                <small>{item.reason ?? item.source}</small>
              </div>
            ))}
          </div>
        ) : <div className="empty-panel">Sin modificaciones registradas.</div>}
      </section>
    </section>
  );
}
