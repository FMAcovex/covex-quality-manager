import Link from "next/link";
import { randomUUID } from "node:crypto";
import { AuditTrailOperation } from "@/components/audit-trail-panel";
import { CsrfField } from "@/components/csrf";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { auditTrailCutoff, auditTrailModules, parseAuditTrailFilters, queryAuditTrail } from "@/lib/audit/trail";
import { createAuditTrailExportAction, recordAuditTrailReviewAction } from "@/lib/audit/trail-actions";
import { qmsModuleByKey } from "@/modules/registry";

export const dynamic="force-dynamic";
// Mismos nombres de módulo que el menú y el dashboard (registro de módulos).
const moduleLabel=(key:string)=>qmsModuleByKey(key)?.labels.plural??key;
type Query={module?:string;record?:string;actor?:string;operation?:string;from?:string;to?:string;critical?:string;reason?:string;review?:string;sensitive?:string;page?:string;reviewed?:string};
const rawFilters=(q:Query)=>Object.fromEntries(["module","record","actor","operation","from","to","critical","reason","review","sensitive"].flatMap(key=>q[key as keyof Query]?[ [key,q[key as keyof Query]!] ]:[]));
function href(q:Query,page:number){const params=new URLSearchParams(rawFilters(q));if(page>1)params.set("page",String(page));return "/audit-trail"+(params.size?"?"+params:"");}

async function AuditTrailPageContent({searchParams}:{searchParams:Promise<Query>}){
  const query=await searchParams,filters=parseAuditTrailFilters(query),page=Math.max(1,Number(query.page)||1);
  const [{operations,total,pageSize,hasNext},cutoff]=await Promise.all([queryAuditTrail(filters,{page}),auditTrailCutoff()]);
  const serialized=JSON.stringify(rawFilters(query));
  const list=<section className="audit-trail-list">{operations.map(operation=><AuditTrailOperation key={operation.id} operation={operation}/>)}{!operations.length?<div className="card empty-state"><strong>No hay operaciones con estos filtros.</strong></div>:null}</section>;
  return <section className="workspace audit-trail-workspace">
    <header className="page-heading"><div><p className="eyebrow">CALIDAD · TRAZABILIDAD</p><h1>Revisión de Audit Trail</h1><p>Consulta transversal del journal protegido, con revisión documental y exportación controlada por permisos independientes.</p></div><PermissionGate permission="AUDIT_TRAIL_EXPORT" module="SYSTEM"><form action={createAuditTrailExportAction}><CsrfField requestId={randomUUID()}/><input type="hidden" name="filters" value={serialized}/><button className="button">Exportar selección filtrada</button></form></PermissionGate></header>
    {query.reviewed?<p className="section-help" role="status">Revisión append-only registrada: <code>{query.reviewed}</code>.</p>:null}
    <form className="card audit-trail-filters"><label><span>Módulo</span><select name="module" defaultValue={query.module??""}><option value="">Todos los módulos</option>{auditTrailModules.map(module=><option key={module} value={module}>{moduleLabel(module)}</option>)}</select></label><label><span>Expediente</span><input name="record" defaultValue={query.record??""} placeholder="Código o UUID"/></label><label><span>Usuario</span><input name="actor" defaultValue={query.actor??""}/></label><label><span>Operación</span><input name="operation" defaultValue={query.operation??""} placeholder="p. ej. DV03"/></label><label><span>Desde UTC</span><input type="date" name="from" defaultValue={query.from??""}/></label><label><span>Hasta UTC</span><input type="date" name="to" defaultValue={query.to??""}/></label><label><span>Criticidad técnica</span><select name="critical" defaultValue={query.critical??""}><option value="">Todas</option><option value="YES">Críticas</option><option value="NO">No críticas</option></select></label><label><span>Motivo</span><select name="reason" defaultValue={query.reason??""}><option value="">Todos</option><option value="WITH">Con motivo</option><option value="WITHOUT">Sin motivo requerido</option></select></label><label><span>Revisión</span><select name="review" defaultValue={query.review??""}><option value="">Todas</option><option value="UNREVIEWED">Pendientes</option><option value="REVIEWED">Revisadas</option><option value="OBSERVATION">Con observación</option></select></label><PermissionGate permission="AUDIT_TRAIL_SENSITIVE_READ" module="SYSTEM"><label className="audit-trail-sensitive"><span>Stream restringido</span><select name="sensitive" defaultValue={query.sensitive??""}><option value="">Negocio ordinario</option><option value="1">Seguridad y administración</option></select></label></PermissionGate><div className="filter-actions"><button className="button primary">Aplicar filtros</button><Link className="button" href="/audit-trail">Limpiar</Link></div></form>
    <div className="audit-trail-summary"><strong>{total}</strong><span>operaciones únicas; las relaciones multiexpediente no duplican el recuento.</span></div>
    <PermissionGate permission="AUDIT_TRAIL_REVIEW" module="SYSTEM" fallback={list}>
      <form action={recordAuditTrailReviewAction} className="audit-trail-review-form"><CsrfField requestId={randomUUID()}/><input type="hidden" name="filters" value={serialized}/>{cutoff?<><input type="hidden" name="cutoffOccurredAt" value={cutoff.occurredAt.toISOString()}/><input type="hidden" name="cutoffOperationId" value={cutoff.id}/></>:null}
        <section className="audit-trail-list">{operations.map(operation=><div className="audit-trail-select" key={operation.id}><label><input type="checkbox" name="operationId" value={operation.id}/><span>Incluir esta operación en el alcance exacto</span></label><AuditTrailOperation operation={operation}/></div>)}{!operations.length?<div className="card empty-state"><strong>No hay operaciones con estos filtros.</strong></div>:null}</section>
        {operations.length&&cutoff?<section className="card audit-trail-review-receipt"><h2>Registrar revisión del alcance seleccionado</h2><p className="muted-note">El recibo es append-only. Documenta la actividad de revisión; no aprueba expedientes, no firma electrónicamente y no modifica eventos.</p><label><span>Resultado técnico</span><select name="result" required defaultValue=""><option value="" disabled>Seleccionar</option><option value="NO_OBSERVATIONS">Revisión completada sin observaciones</option><option value="OBSERVATIONS_RECORDED">Observaciones registradas</option><option value="FOLLOW_UP_REQUIRED">Requiere seguimiento fuera de este recibo</option></select></label><label><span>Observaciones</span><textarea name="notes" maxLength={4000}/></label><label><span>Rectifica una revisión anterior (opcional)</span><input name="supersedesId" placeholder="UUID del recibo anterior"/></label><button className="button primary">Registrar revisión seleccionada</button></section>:null}
      </form>
    </PermissionGate>
    <nav className="form-footer" aria-label="Paginación"><span>Página {page} de {Math.max(1,Math.ceil(total/pageSize))}</span>{page>1?<Link className="button small" href={href(query,page-1)}>Anterior</Link>:null}{hasNext?<Link className="button small" href={href(query,page+1)}>Siguiente</Link>:null}</nav>
  </section>;
}

export default async function AuditTrailPage(...args:Parameters<typeof AuditTrailPageContent>){return authorizedPage("src/app/audit-trail/page.tsx",()=>AuditTrailPageContent(...args),args);}
