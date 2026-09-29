import Link from "next/link";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { isActiveTemplateAssetReady } from "@/modules/configuration/template-readiness";
import { ColumnSelector } from "@/components/column-selector";
import { complaintColumns } from "@/modules/complaints/column-config";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { complaintClassificationLabel,complaintEffectivenessLabel,complaintStatusLabel,complaintTypeLabel,formatDate } from "@/modules/complaints/domain";
import { getComplaintList } from "@/modules/complaints/queries";
import { ManualReminderToolbar } from "@/components/manual-reminder-toolbar";

export const dynamic="force-dynamic";
const p=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;

export default async function ComplaintsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
 const filters={q:p(q.q),administrative:p(q.administrative),year:p(q.year),department:p(q.department),type:p(q.type),status:p(q.status),classification:p(q.classification),effectiveness:p(q.effectiveness)};
 const {rows,departments,years,counters}=await getComplaintList(filters);const officialTemplateReady=await isActiveTemplateAssetReady(QmsRecordType.COMPLAINT,DocumentType.COMPLAINT_ANNEX_V);
 const exportParams=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>{if(v)exportParams.set(k,v)});
 const currentYear=filters.year??String(new Date().getFullYear());
 return <section className="workspace">
  <div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Reclamaciones</h1><p>Registro, investigación, resolución, eficacia y cierre.</p></div>
   <div className="heading-actions"><Link href="/complaints/new" className="button primary">+ Nueva reclamación</Link><ColumnSelector tableId="complaint-list-table" storageKey="qms.columns.complaints" columns={[...complaintColumns]}/>
    <details className="export-menu"><summary className="button">Exportar ▾</summary><div className="export-popover"><strong>Exportaciones</strong>{officialTemplateReady?<a className="export-link" href={`/api/complaints/export/annex-v?year=${currentYear}`}>Anexo V oficial · año {currentYear}</a>:<span className="template-missing-note">Anexo V bloqueado · plantilla oficial pendiente de cargar.</span>}<a className="export-link" href={`/api/complaints/export/simple?${exportParams.toString()}`}>Listado simple · filtros actuales</a><a className="export-link" href={`/api/complaints/export/simple?year=${currentYear}`}>Listado simple · año {currentYear}</a></div></details>
   </div>
  </div>
  <div className="tabs"><Link className="tab active" href="/complaints">Expedientes</Link><Link className="tab muted" href="/complaints/indicators">Indicadores</Link></div>
  <form method="get" className="toolbar-form"><div className="filter-panel operational">
   <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative??""}><option value="">Activos</option><option value="ANNULLED">Anulados</option><option value="ALL">Todos</option></select></label>
   <label className="filter-placeholder"><span>Año</span><select name="year" defaultValue={filters.year??""}><option value="">Todos</option>{years.map(y=><option key={y}>{y}</option>)}</select></label>
   <label className="filter-placeholder"><span>Departamento</span><select name="department" defaultValue={filters.department??""}><option value="">Todos</option>{departments.map(d=><option key={d.id} value={d.id}>{d.code}</option>)}</select></label>
   <label className="filter-placeholder"><span>Tipo</span><select name="type" defaultValue={filters.type??""}><option value="">Todos</option><option value="CUSTOMER">De cliente</option><option value="PROVIDER">A proveedor</option></select></label>
   <label className="filter-placeholder"><span>Clasificación</span><select name="classification" defaultValue={filters.classification??""}><option value="">Todas</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="NO_GMP_IMPACT">Sin impacto GMP</option></select></label>
   <label className="filter-placeholder"><span>Estado</span><select name="status" defaultValue={filters.status??""}><option value="">Todos</option><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label>
   <label className="filter-placeholder"><span>Eficacia</span><select name="effectiveness" defaultValue={filters.effectiveness??""}><option value="">Todas</option><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Aceptable</option><option value="NOT_ACCEPTABLE">No aceptable</option><option value="NOT_REQUIRED">No requerida</option></select></label>
   <div className="filter-actions"><button className="button small">Aplicar</button><Link className="button small" href="/complaints">Limpiar</Link></div>
  </div><div className="search-row">
          <SearchAutocomplete
            defaultValue={filters.q ?? ""}
            placeholder="Buscar código, reclamante, referencia, lote, descripción o causa raíz…"
            suggestions={rows.map((row) => ({
              id: row.id,
              href: `/complaints/${row.id}`,
              code: row.qmsRecord.businessCode ?? "Sin código",
              title: row.description ?? row.partyName ?? "Sin descripción",
              meta: [row.departmentCodeSnapshot, row.status === "OPEN" ? "Abierta" : "Cerrada"].filter(Boolean).join(" · "),
              searchText: [
                row.qmsRecord.businessCode,
                row.partyName,
                row.reference,
                row.lotReference,
                row.description,
                row.rootCause,
                row.internalObservations,
                ...row.capaPlans.map((plan) => plan.description),
              ].filter(Boolean).join(" "),
            }))}
          />
          <button className="button" type="submit">Buscar</button>
        </div></form>
  <div className="status-strip"><div><strong>{counters.total}</strong><span>Reclamaciones</span></div><div><strong>{counters.open}</strong><span>Abiertas</span></div><div><strong>{counters.pendingEfficacy}</strong><span>Eficacia pendiente</span></div><div><strong>{counters.followupDue}</strong><span>Seguimientos vencidos</span></div></div>
  <ManualReminderToolbar tableId="complaint-list-table" moduleLabel="Reclamaciones" />
  <div className="table-card"><div className="table-scroll"><table id="complaint-list-table"><thead><tr><th className="reminder-select-column" aria-label="Seleccionar"><input type="checkbox" data-reminder-select-all="true" aria-label="Seleccionar todas las reclamaciones visibles" /></th>{complaintColumns.map(c=><th key={c.key} data-column-key={c.key}>{c.label}</th>)}</tr></thead><tbody>
   {rows.length?rows.map(r=><tr key={r.id}>
    <td className="reminder-select-column"><input type="checkbox" data-reminder-record="true" data-reminder-id={r.qmsRecord.id} data-reminder-code={qmsRecordDisplayCode(r.qmsRecord)} data-reminder-summary={r.description??r.partyName??"Sin descripción"} data-reminder-status={complaintStatusLabel(r.status)} data-reminder-meta={r.departmentCodeSnapshot??""} data-reminder-href={`/complaints/${r.id}`} aria-label={`Seleccionar ${r.qmsRecord.businessCode??"reclamación"}`} /></td>
    <td data-column-key="control">{r.dataQualityStatus!=="COMPLETE"?<span className="control-flag">⚠ Revisar</span>:"—"}</td>
    <td data-column-key="code"><Link className="summary-link" href={`/complaints/${r.id}`}>{qmsRecordDisplayCode(r.qmsRecord)}</Link>{!r.qmsRecord.isActive?<span className="badge neutral">Anulado</span>:null}</td>
    <td data-column-key="type">{complaintTypeLabel(r.complaintType)}</td><td data-column-key="opening">{formatDate(r.openedAt)}</td><td data-column-key="party">{r.partyName??"—"}</td>
    <td data-column-key="product" className="table-cell-wrap">{r.reference??r.affectedScope??"—"}</td><td data-column-key="lot">{r.lotReference??"—"}</td>
    <td data-column-key="classification"><span className={`badge ${r.classification?.toLowerCase()??"neutral"}`}>{complaintClassificationLabel(r.classification)}</span></td>
    <td data-column-key="status"><span className={`badge ${r.status==="OPEN"?"open":"closed"}`}>{complaintStatusLabel(r.status)}</span></td>
    <td data-column-key="effectiveness">{complaintEffectivenessLabel(r.effectivenessStatus)}</td><td data-column-key="closing">{formatDate(r.closedAt)}</td>
    <td data-column-key="capa" className="table-cell-wrap">{[r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")||"—"}</td>
    <td data-column-key="related"><div className="relation-chips">
      {[...r.qmsRecord.sourceRelations.map(x=>x.targetRecord),...r.qmsRecord.targetRelations.map(x=>x.sourceRecord)].map(record=><Link key={record.id} className="relation-chip" href={qmsRecordHref(record.recordType,record.id)} title={qmsRecordTypeLabel(record.recordType)}>{qmsRecordDisplayCode(record,qmsRecordTypeLabel(record.recordType))}{!record.isActive?" · Anulado":""}</Link>)}
      {r.qmsRecord.sourceRelations.length+r.qmsRecord.targetRelations.length===0?"—":null}
    </div></td>
   </tr>):<tr><td colSpan={14} className="empty-state"><strong>No hay reclamaciones con estos filtros.</strong></td></tr>}
  </tbody></table></div></div>
 </section>;
}
