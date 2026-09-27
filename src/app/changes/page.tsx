import Link from "next/link";
import { ColumnSelector } from "@/components/column-selector";
import { changeControlColumns } from "@/modules/change-control/column-config";
import {
  changeClassificationLabel,changeEffectivenessLabel,changeExecutionLabel,changeStatusLabel,formatDate,
} from "@/modules/change-control/domain";
import { getChangeControlList } from "@/modules/change-control/queries";

export const dynamic="force-dynamic";
const p=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;

export default async function ChangeControlPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const q=await searchParams;
  const filters={
    q:p(q.q),year:p(q.year),department:p(q.department),classification:p(q.classification),
    status:p(q.status),execution:p(q.execution),effectiveness:p(q.effectiveness),followup:p(q.followup),
  };
  const {rows,departments,years,counters}=await getChangeControlList(filters);
  const exportParams=new URLSearchParams();
  Object.entries(filters).forEach(([key,value])=>{if(value&&key!=="q"&&key!=="followup")exportParams.set(key,value);});

  return <section className="workspace">
    <div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Controles de cambios</h1><p>Solicitud, dictamen, ejecución, seguimientos, eficacia y cierre.</p></div>
      <div className="heading-actions"><Link className="button primary" href="/changes/new">+ Nuevo control</Link>
        <ColumnSelector tableId="change-list-table" storageKey="qms.columns.changes" columns={[...changeControlColumns]}/>
        <details className="export-menu"><summary className="button">Exportar ▾</summary><div className="export-popover">
          <strong>Exportaciones</strong>
          <form action="/api/changes/export/annex-vii" method="get" className="export-year-form"><label><span>Anexo VII oficial</span>
            <select name="year" defaultValue={filters.year??String(new Date().getFullYear())}>{Array.from(new Set([Number(filters.year??new Date().getFullYear()),...years])).filter(Number.isInteger).sort((a,b)=>b-a).map((y)=><option key={y}>{y}</option>)}</select>
          </label><button className="button small">Descargar</button></form>
          <a className="export-link" href={`/api/changes/export/simple?${exportParams.toString()}`}>Listado simple · filtros actuales</a>
          <a className="export-link" href="/api/changes/export/simple">Listado simple completo</a>
        </div></details>
      </div>
    </div>
    <div className="tabs"><Link className="tab active" href="/changes">Expedientes</Link><Link className="tab muted" href="/changes/indicators">Indicadores</Link></div>
    <form method="get" className="toolbar-form">
      <div className="filter-panel operational change-filters">
        <label className="filter-placeholder"><span>Año</span><select name="year" defaultValue={filters.year??""}><option value="">Todos</option>{years.map((y)=><option key={y}>{y}</option>)}</select></label>
        <label className="filter-placeholder"><span>Departamento</span><select name="department" defaultValue={filters.department??""}><option value="">Todos</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.code}</option>)}</select></label>
        <label className="filter-placeholder"><span>Clasificación</span><select name="classification" defaultValue={filters.classification??""}><option value="">Todas</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option></select></label>
        <label className="filter-placeholder"><span>Ejecución</span><select name="execution" defaultValue={filters.execution??""}><option value="">Todas</option><option value="NOT_EXECUTED">No ejecutado</option><option value="EXECUTED">Ejecutado</option></select></label>
        <label className="filter-placeholder"><span>Eficacia</span><select name="effectiveness" defaultValue={filters.effectiveness??""}><option value="">Todas</option><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Aceptable</option><option value="NOT_ACCEPTABLE">No aceptable</option></select></label>
        <label className="filter-placeholder"><span>Estado</span><select name="status" defaultValue={filters.status??""}><option value="">Todos</option><option value="OPEN">Abierto</option><option value="CLOSED">Cerrado</option><option value="REJECTED">Rechazado</option><option value="CANCELLED">Cancelado</option></select></label>
        <label className="filter-placeholder"><span>Seguimiento</span><select name="followup" defaultValue={filters.followup??""}><option value="">Todos</option><option value="due">Vencido</option><option value="scheduled">Programado</option><option value="none">Sin próxima fecha</option></select></label>
        <div className="filter-actions"><button className="button small">Aplicar</button><Link className="button small" href="/changes">Limpiar</Link></div>
      </div>
      <div className="search-row"><input name="q" defaultValue={filters.q??""} placeholder="Buscar código, descripción, justificación, acción u observaciones…"/><button className="button">Buscar</button></div>
    </form>
    <div className="summary-strip">
      <div><span>Total</span><strong>{counters.total}</strong></div>
      <div><span>Abiertos</span><strong>{counters.open}</strong></div>
      <div><span>Pendientes de ejecución</span><strong>{counters.pendingExecution}</strong></div>
      <div><span>Ejecutados pendientes de cierre</span><strong>{counters.executedPendingClosure}</strong></div>
      <div><span>Seguimiento vencido</span><strong>{counters.overdueFollowups}</strong></div>
    </div>
    <div className="table-card"><div className="table-scroll"><table id="change-list-table" className="records-table change-table">
      <thead><tr><th data-column-key="control">Control</th><th data-column-key="code">Codificación</th><th data-column-key="department">Departamento</th><th data-column-key="description">Descripción</th><th data-column-key="requestDate">Fecha solicitud</th><th data-column-key="approvalDate">Fecha aprobación</th><th data-column-key="classification">Clasificación</th><th data-column-key="planned">Fecha prevista</th><th data-column-key="execution">Estado ejecución</th><th data-column-key="executionDate">Fecha ejecución</th><th data-column-key="effectiveness">Eficacia</th><th data-column-key="lastFollowup">Último seguimiento</th><th data-column-key="nextFollowup">Próximo seguimiento</th><th data-column-key="status">Estado final</th><th data-column-key="closeDate">Fecha cierre</th><th data-column-key="observations">Observaciones</th></tr></thead>
      <tbody>{rows.map((row)=>{
        const latest=row.followups[0];
        return <tr key={row.id}>
          <td data-column-key="control">{row.dataQualityStatus!=="COMPLETE"?<span className="control-flag">⚠ {row.dataQualityStatus==="INCOMPLETE"?"Incompleto":"Revisar"}</span>:"—"}</td>
          <td data-column-key="code" className="sticky-code"><Link href={`/changes/${row.id}`}><strong>{row.qmsRecord.businessCode??"Sin código"}</strong></Link></td>
          <td data-column-key="department">{row.departmentCodeSnapshot??"—"}</td>
          <td data-column-key="description" className="long-cell">{row.description??"—"}</td>
          <td data-column-key="requestDate">{formatDate(row.requestedAt)}</td><td data-column-key="approvalDate">{formatDate(row.decisionAt??row.requestDecisionAt)}</td>
          <td data-column-key="classification"><span className={`badge ${row.classification==="MAJOR"?"major":"minor"}`}>{changeClassificationLabel(row.classification)}</span></td>
          <td data-column-key="planned">{formatDate(row.plannedImplementationAt)}</td>
          <td data-column-key="execution">{changeExecutionLabel(row.executionStatus)}</td><td data-column-key="executionDate">{formatDate(row.executedAt)}</td>
          <td data-column-key="effectiveness"><span className={`badge ${row.effectivenessStatus==="ACCEPTABLE"?"closed":row.effectivenessStatus==="NOT_ACCEPTABLE"?"major":"warning"}`}>{changeEffectivenessLabel(row.effectivenessStatus)}</span></td>
          <td data-column-key="lastFollowup">{latest?`${String(latest.sequenceNumber).padStart(2,"0")} · ${formatDate(latest.followupDate)}`:"—"}</td>
          <td data-column-key="nextFollowup">{formatDate(latest?.nextFollowupDate)}</td>
          <td data-column-key="status"><span className={`status-badge ${row.status.toLowerCase()}`}>{changeStatusLabel(row.status)}</span></td>
          <td data-column-key="closeDate">{formatDate(row.effectiveClosedAt)}</td>
          <td data-column-key="observations" className="long-cell">{row.internalObservations??row.closureConclusion??"—"}</td>
        </tr>;
      })}{!rows.length?<tr><td colSpan={16}><div className="empty-panel">No hay controles de cambio que coincidan con los filtros.</div></td></tr>:null}</tbody>
    </table></div></div>
  </section>;
}
