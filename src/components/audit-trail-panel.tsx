import Link from "next/link";
import { queryAuditTrail, legacyTrail, type TrailOperation } from "@/lib/audit/trail";
import catalog from "@/lib/audit/policy-catalog.json";

const operationLabels=new Map(catalog.operations.map(operation=>[operation.id,operation.title]));
const dateTime=(value:Date)=>new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"medium",timeZone:"UTC"}).format(value)+" UTC";
function typedValue(raw:unknown){
  if(!raw||typeof raw!=="object")return raw==null?"NULL":String(raw);
  const value=raw as {present?:boolean;type?:string;value?:unknown};
  if(value.present===false)return "Ausente";
  if(value.type==="NULL"||value.value===null)return "NULL";
  if(value.type==="DATE")return String(value.value);
  if(value.type==="INSTANT") { const parsed=new Date(String(value.value));return Number.isNaN(parsed.valueOf())?String(value.value):dateTime(parsed); }
  if(value.type==="JSON")return JSON.stringify(value.value,null,2);
  if(value.type==="BOOLEAN")return value.value?"Sí":"No";
  return typeof value.value==="object"?JSON.stringify(value.value,null,2):String(value.value??"");
}
function pageHref(basePath:string,page:number){const url=new URL(basePath,"http://local");url.searchParams.set("tab","audit-trail");url.searchParams.set("auditPage",String(page));return url.pathname+url.search;}
export function AuditTrailOperation({operation}:{operation:TrailOperation}){
  return <article className="audit-trail-operation">
    <header><div><p className="eyebrow">{operationLabels.get(operation.operation)??operation.operation}</p><h3>{dateTime(operation.occurredAt)}</h3></div><div className="audit-trail-badges"><span className={`badge ${operation.critical?"critical":"neutral"}`}>{operation.critical?"Crítica técnica":"No crítica"}</span>{operation.reviews.length?<span className="badge open">Revisada</span>:<span className="badge neutral">Pendiente de revisión</span>}</div></header>
    <dl className="audit-trail-operation-meta"><div><dt>Ejecutor</dt><dd>{operation.actorName}</dd></div><div><dt>Correlación</dt><dd><code>{operation.id}</code></dd></div><div><dt>Secuencia</dt><dd>{operation.aggregateSequence?.toString()??"—"}</dd></div><div><dt>Motivo</dt><dd>{operation.reason||"No requerido para esta operación"}</dd></div></dl>
    <details><summary>{operation.events.length} cambio{operation.events.length===1?"":"s"} persistido{operation.events.length===1?"":"s"}</summary><div className="table-scroll"><table className="audit-trail-events"><thead><tr><th>Entidad</th><th>Campo</th><th>Valor anterior</th><th>Valor nuevo</th><th>Referencia</th></tr></thead><tbody>{operation.events.map(event=><tr key={event.id}><td><strong>{event.entityType}</strong><small>{event.entityId}</small></td><td><code>{event.fieldPath}</code></td><td><pre>{typedValue(event.oldValue)}</pre></td><td><pre>{typedValue(event.newValue)}</pre></td><td>{event.recordVersionId?<span>Versión {event.recordVersionId.slice(0,8)}</span>:event.generatedDocumentId?<span>Documento {event.generatedDocumentId.slice(0,8)}{event.documentChecksum?<small>SHA {event.documentChecksum}</small>:null}</span>:"—"}</td></tr>)}</tbody></table></div></details>
    {operation.reviews.length?<details><summary>Revisiones documentadas</summary><ul>{operation.reviews.map(review=><li key={review.id}>{dateTime(review.createdAt)} · {review.reviewerName} · {review.result}</li>)}</ul></details>:null}
  </article>;
}

export async function AuditTrailPanel({rootKey,basePath,page=1}:{rootKey:string;basePath:string;page?:number}){
  const [{operations,total,pageSize,hasNext},legacy]=await Promise.all([queryAuditTrail({}, {rootKey,page}),legacyTrail(rootKey)]);
  return <div className="audit-trail-panel">
    <section className="card audit-trail-intro"><h2>Audit Trail</h2><p>Registro técnico protegido de las operaciones del expediente. La criticidad mostrada es una propuesta técnica pendiente de aceptación QA/DT; esta vista no constituye una firma ni una aprobación GMP.</p><p className="muted-note">Fechas mostradas en UTC. Las operaciones se agrupan por transacción y los valores conservan tipo, NULL y ausencia.</p></section>
    <section className="audit-trail-list" aria-label="Operaciones de Audit Trail">{operations.map(operation=><AuditTrailOperation key={operation.id} operation={operation}/>)}{!operations.length?<div className="card empty-state"><strong>Sin operaciones en el audit trail para este expediente.</strong><p>El historial anterior permanece separado debajo.</p></div>:null}</section>
    <nav className="form-footer" aria-label="Paginación de Audit Trail"><span>{total} operaciones · página {page} de {Math.max(1,Math.ceil(total/pageSize))}</span>{page>1?<Link className="button small" href={pageHref(basePath,page-1)}>Anterior</Link>:null}{hasNext?<Link className="button small" href={pageHref(basePath,page+1)}>Siguiente</Link>:null}</nav>
    <section className="card audit-trail-legacy"><h2>Historial operativo anterior o no incorporado al Audit Trail</h2><p className="muted-note">Fuente legada conservada como tal. No se reconstruye identidad ni se presenta retrospectivamente como evento GMP validado.</p><details><summary>{legacy.history.length} cambios legados recientes</summary><ol>{legacy.history.map(item=><li key={item.id}><strong>{item.fieldPath}</strong><span>{dateTime(item.changedAt)} · {item.changedByText||"Actor histórico no identificado"}</span><p>{item.reason||"Sin motivo histórico estructurado"}</p></li>)}</ol></details><details><summary>{legacy.versions.length} versiones recientes</summary><ol>{legacy.versions.map(version=><li key={version.id}><strong>Versión {String(version.sequenceNumber)}</strong><span>{dateTime(version.createdAt)} · {version.createdByText||"Actor histórico no identificado"} · {String(version.kind)}</span></li>)}</ol></details></section>
  </div>;
}
