import Link from "next/link";
import { ColumnSelector } from "@/components/column-selector";
import { complaintColumns } from "@/modules/complaints/column-config";
import { complaintClassificationLabel,complaintEffectivenessLabel,complaintStatusLabel,complaintTypeLabel,formatDate } from "@/modules/complaints/domain";
import { getComplaintList } from "@/modules/complaints/queries";

export const dynamic="force-dynamic";
const p=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;

export default async function ComplaintsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
 const filters={q:p(q.q),year:p(q.year),department:p(q.department),type:p(q.type),status:p(q.status),classification:p(q.classification),effectiveness:p(q.effectiveness)};
 const {rows,departments,years,counters}=await getComplaintList(filters);
 const exportParams=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v)exportParams.set(k,v)});
 const currentYear=filters.year??String(new Date().getFullYear());
 return <section className="workspace">
  <div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Reclamaciones</h1><p>Registro, investigación, resolución, eficacia y cierre.</p></div>
   <div className="heading-actions"><Link href="/complaints/new" className="button primary">+ Nueva reclamación</Link><ColumnSelector tableId="complaint-list-table" storageKey="qms.columns.complaints" columns={[...complaintColumns]}/>
    <details className="export-menu"><summary className="button">Exportar ▾</summary><div className="export-popover"><strong>Exportaciones</strong><a className="export-link" href={`/api/complaints/export/annex-v?year=${currentYear}`}>Anexo V oficial · año {currentYear}</a><a className="export-link" href={`/api/complaints/export/simple?${exportParams.toString()}`}>Listado simple · filtros actuales</a><a className="export-link" href={`/api/complaints/export/simple?year=${currentYear}`}>Listado simple · año {currentYear}</a></div></details>
   </div>
  </div>
  <div className="tabs"><Link className="tab active" href="/complaints">Expedientes</Link><Link className="tab muted" href="/complaints/indicators">Indicadores</Link></div>
  <form method="get" className="toolbar-form"><div className="filter-panel operational">
   <label className="filter-placeholder"><span>Año</span><select name="year" defaultValue={filters.year??""}><option value="">Todos</option>{years.map(y=><option key={y}>{y}</option>)}</select></label>
   <label className="filter-placeholder"><span>Departamento</span><select name="department" defaultValue={filters.department??""}><option value="">Todos</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code}</option>)}</select></label>
   <label className="filter-placeholder"><span>Tipo</span><select name="type" defaultValue={filters.type??""}><option value="">Todos</option><option value="CUSTOMER">De cliente</option><option value="PROVIDER">A proveedor</option></select></label>
   <label className="filter-placeholder"><span>Clasificación</span><select name="classification" defaultValue={filters.classification??""}><option value="">Todas</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="NO_GMP_IMPACT">Sin impacto GMP</option></select></label>
   <label className="filter-placeholder"><span>Estado</span><select name="status" defaultValue={filters.status??""}><option value="">Todos</option><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label>
   <label className="filter-placeholder"><span>Eficacia</span><select name="effectiveness" defaultValue={filters.effectiveness??""}><option value="">Todas</option><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Aceptable</option><option value="NOT_ACCEPTABLE">No aceptable</option><option value="NOT_REQUIRED">No requerida</option></select></label>
   <div className="filter-actions"><button className="button small">Aplicar</button><Link className="button small" href="/complaints">Limpiar</Link></div>
  </div><div className="search-row"><input name="q" defaultValue={filters.q??""} placeholder="Buscar código, cliente/proveedor, producto, lote, descripción, causa raíz o CAPA…"/><button className="button">Buscar</button></div></form>
  <div className="status-strip"><div><strong>{counters.total}</strong><span>Reclamaciones</span></div><div><strong>{counters.open}</strong><span>Abiertas</span></div><div><strong>{counters.pendingEfficacy}</strong><span>Eficacia pendiente</span></div><div><strong>{counters.followupDue}</strong><span>Seguimientos vencidos</span></div></div>
  <div className="table-card"><div className="table-scroll"><table id="complaint-list-table"><thead><tr>{complaintColumns.map(c=><th key={c.key} data-column-key={c.key}>{c.label}</th>)}</tr></thead><tbody>
   {rows.length?rows.map(r=><tr key={r.id}>
    <td data-column-key="control">{r.dataQualityStatus!=="COMPLETE"?<span className="control-flag">⚠ Revisar</span>:"—"}</td>
    <td data-column-key="code"><Link className="summary-link" href={`/complaints/${r.id}`}>{r.qmsRecord.businessCode??"Sin código"}</Link></td>
    <td data-column-key="type">{complaintTypeLabel(r.complaintType)}</td><td data-column-key="opening">{formatDate(r.openedAt)}</td><td data-column-key="party">{r.partyName??"—"}</td>
    <td data-column-key="product" className="table-cell-wrap">{r.reference??r.affectedScope??"—"}</td><td data-column-key="lot">{r.lotReference??"—"}</td>
    <td data-column-key="classification"><span className={`badge ${r.classification?.toLowerCase()??"neutral"}`}>{complaintClassificationLabel(r.classification)}</span></td>
    <td data-column-key="status"><span className={`badge ${r.status==="OPEN"?"open":"closed"}`}>{complaintStatusLabel(r.status)}</span></td>
    <td data-column-key="effectiveness">{complaintEffectivenessLabel(r.effectivenessStatus)}</td><td data-column-key="closing">{formatDate(r.closedAt)}</td>
    <td data-column-key="capa" className="table-cell-wrap">{[r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")||"—"}</td>
   </tr>):<tr><td colSpan={12} className="empty-state"><strong>No hay reclamaciones con estos filtros.</strong></td></tr>}
  </tbody></table></div></div>
 </section>;
}
