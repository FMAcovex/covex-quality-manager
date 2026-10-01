import Link from "next/link";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { isActiveTemplateAssetReady } from "@/modules/configuration/template-readiness";
import { ColumnSelector } from "@/components/column-selector";
import { complaintColumns } from "@/modules/complaints/column-config";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import {
  complaintClassificationLabel,
  complaintEffectivenessLabel,
  complaintFollowupState,
  complaintOperationalSituation,
  complaintOperationalSituationLabel,
  complaintOperationalSituationTone,
  complaintStatusLabel,
  complaintTypeLabel,
  formatDate,
} from "@/modules/complaints/domain";
import { getComplaintList } from "@/modules/complaints/queries";
import { ManualReminderToolbar } from "@/components/manual-reminder-toolbar";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { appendFilterValues, firstQueryValue, queryList } from "@/lib/qms/list-filters";
import { versionLabel } from "@/lib/qms/versioning";

export const dynamic="force-dynamic";
const p=firstQueryValue;

function efficacyTone(value:string){
 if(value==="ACCEPTABLE")return "conforming";
 if(value==="NOT_ACCEPTABLE")return "nonconforming";
 if(value==="PENDING")return "warning";
 return "neutral";
}

export default async function ComplaintsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
 const filters={
  q:p(q.q),administrative:p(q.administrative),year:queryList(q.year),department:queryList(q.department),
  type:queryList(q.type),status:queryList(q.status),classification:queryList(q.classification),
  effectiveness:queryList(q.effectiveness),situation:queryList(q.situation),followup:queryList(q.followup)
 };
 const {rows,departments,years,counters}=await getComplaintList(filters);
 const officialTemplateReady=await isActiveTemplateAssetReady(QmsRecordType.COMPLAINT,DocumentType.COMPLAINT_ANNEX_V);
 const exportParams=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>appendFilterValues(exportParams,k,v));
 const currentYear=filters.year[0]??String(new Date().getFullYear());
 const today=new Date();

 return <section className="workspace">
  <div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Reclamaciones</h1><p>Registro, investigación, resolución, seguimiento, eficacia y cierre.</p></div>
   <div className="heading-actions"><Link href="/complaints/new" className="button primary">+ Nueva reclamación</Link><ColumnSelector tableId="complaint-list-table" storageKey="qms.columns.complaints.r1" columns={[...complaintColumns]}/>
    <details className="export-menu"><summary className="button">Exportar ▾</summary><div className="export-popover"><strong>Exportaciones</strong>{officialTemplateReady?<a className="export-link" href={`/api/complaints/export/annex-v?year=${currentYear}`}>Anexo V oficial · año {currentYear}</a>:<span className="template-missing-note">Anexo V bloqueado · plantilla oficial pendiente de cargar.</span>}<a className="export-link" href={`/api/complaints/export/simple?${exportParams.toString()}`}>Listado simple · filtros actuales</a><a className="export-link" href={`/api/complaints/export/simple?year=${currentYear}`}>Listado simple · año {currentYear}</a></div></details>
   </div>
  </div>

  <div className="tabs"><Link className="tab active" href="/complaints">Expedientes</Link><Link className="tab muted" href="/complaints/indicators">Indicadores</Link></div>

  <form method="get" className="toolbar-form"><div className="filter-panel operational complaint-filter-panel">
   <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative??""}><option value="">Activos</option><option value="ANNULLED">Anulados</option><option value="ALL">Todos</option></select></label>
   <MultiSelectFilter name="year" label="Año" selected={filters.year} options={years.map((y)=>({value:String(y),label:String(y)}))}/>
   <MultiSelectFilter name="department" label="Departamento" selected={filters.department} options={departments.map((d)=>({value:d.id,label:d.code}))}/>
   <MultiSelectFilter name="type" label="Tipo" selected={filters.type} options={[{value:"CUSTOMER",label:"De cliente"},{value:"PROVIDER",label:"A proveedor"}]}/>
   <MultiSelectFilter name="classification" label="Clasificación" selected={filters.classification} options={[{value:"CRITICAL",label:"Crítica"},{value:"MAJOR",label:"Mayor"},{value:"MINOR",label:"Menor"},{value:"NO_GMP_IMPACT",label:"Sin impacto GMP"}]}/>
   <MultiSelectFilter name="status" label="Estado" selected={filters.status} options={[{value:"DRAFT",label:"Borrador"},{value:"OPEN",label:"Abierta"},{value:"CLOSED",label:"Cerrada"}]}/>
   <MultiSelectFilter name="situation" label="Situación" selected={filters.situation} options={[
    {value:"PART_I",label:"Parte I en curso"},{value:"PART_II_DECISION_PENDING",label:"Pendiente Parte II"},
    {value:"PART_I_CLOSURE_PENDING",label:"Pendiente cierre Parte I"},{value:"PART_II",label:"Parte II / seguimiento"},
    {value:"EFFECTIVENESS_PENDING",label:"Pendiente eficacia"},{value:"EFFECTIVENESS_NONCONFORMING",label:"Eficacia no conforme"}
   ]}/>
   <MultiSelectFilter name="effectiveness" label="Eficacia" selected={filters.effectiveness} options={[{value:"PENDING",label:"Pendiente"},{value:"ACCEPTABLE",label:"Conforme"},{value:"NOT_ACCEPTABLE",label:"No conforme"},{value:"NOT_REQUIRED",label:"N/A"}]}/>
   <MultiSelectFilter name="followup" label="Seguimiento" selected={filters.followup} options={[{value:"OVERDUE",label:"Vencido"},{value:"PENDING",label:"Pendiente"},{value:"MISSING",label:"Sin fecha"}]}/>
   <div className="filter-actions"><button className="button small">Aplicar</button><Link className="button small" href="/complaints">Limpiar</Link></div>
  </div><div className="search-row">
   <SearchAutocomplete
    defaultValue={filters.q??""}
    placeholder="Buscar código, cliente/proveedor, referencia, lote, descripción o causa raíz…"
    suggestions={rows.map((row)=>{
      const situation=complaintOperationalSituation(row);
      return {
       id:row.id,href:`/complaints/${row.id}`,code:row.qmsRecord.businessCode??"Sin código",
       title:row.description??row.partyName??"Sin descripción",
       meta:[row.departmentCodeSnapshot,complaintStatusLabel(row.status),complaintOperationalSituationLabel(situation)].filter(Boolean).join(" · "),
       searchText:[row.qmsRecord.businessCode,row.partyName,row.reference,row.lotReference,row.description,row.rootCause,row.internalObservations,...row.capaPlans.map((plan)=>plan.description)].filter(Boolean).join(" ")
      };
    }}
   />
   <button className="button" type="submit">Buscar</button>
  </div></form>

  <div className="status-strip complaint-status-strip">
   <div><strong>{counters.total}</strong><span>Operativas</span></div>
   <div><strong>{counters.drafts}</strong><span>Borradores</span></div>
   <div><strong>{counters.open}</strong><span>Abiertas</span></div>
   <div><strong>{counters.pendingPartII}</strong><span>Pendientes Parte II</span></div>
   <div><strong>{counters.pendingEfficacy}</strong><span>Eficacia pendiente</span></div>
   <div><strong>{counters.followupDue}</strong><span>Seguimientos vencidos</span></div>
  </div>

  <ManualReminderToolbar tableId="complaint-list-table" moduleLabel="Reclamaciones" />

  <div className="table-card"><div className="table-scroll"><table id="complaint-list-table"><thead><tr><th className="reminder-select-column" aria-label="Seleccionar"><input type="checkbox" data-reminder-select-all="true" aria-label="Seleccionar todas las reclamaciones visibles"/></th>{complaintColumns.map(c=><th key={c.key} data-column-key={c.key}>{c.label}</th>)}</tr></thead><tbody>
   {rows.length?rows.map(r=>{
    const situation=complaintOperationalSituation(r);
    const followupState=complaintFollowupState(r,today);
    const currentVersion=r.qmsRecord.versions[0]?.sequenceNumber;
    const related=[...r.qmsRecord.sourceRelations.map(x=>x.targetRecord),...r.qmsRecord.targetRelations.map(x=>x.sourceRecord)];
    return <tr key={r.id} className={followupState==="OVERDUE"?"complaint-followup-overdue":undefined}>
     <td className="reminder-select-column"><input type="checkbox" data-reminder-record="true" data-reminder-id={r.qmsRecord.id} data-reminder-code={qmsRecordDisplayCode(r.qmsRecord)} data-reminder-summary={r.description??r.partyName??"Sin descripción"} data-reminder-status={complaintOperationalSituationLabel(situation)} data-reminder-meta={r.departmentCodeSnapshot??""} data-reminder-href={`/complaints/${r.id}`} aria-label={`Seleccionar ${r.qmsRecord.businessCode??"reclamación"}`}/></td>
     <td data-column-key="control">{r.dataQualityStatus!=="COMPLETE"?<span className="control-flag">⚠ Revisar</span>:"—"}</td>
     <td data-column-key="code"><Link className="summary-link" href={`/complaints/${r.id}`}>{qmsRecordDisplayCode(r.qmsRecord)}</Link>{!r.qmsRecord.isActive?<span className="badge neutral">Anulado</span>:null}</td>
     <td data-column-key="version">{currentVersion===undefined?"—":versionLabel(currentVersion)}</td>
     <td data-column-key="type">{complaintTypeLabel(r.complaintType)}</td>
     <td data-column-key="opening">{formatDate(r.openedAt)}</td>
     <td data-column-key="party">{r.partyName??"—"}</td>
     <td data-column-key="product" className="table-cell-wrap">{r.reference??r.affectedScope??"—"}</td>
     <td data-column-key="lot">{r.lotReference??"—"}</td>
     <td data-column-key="classification"><span className={`badge ${r.classification?.toLowerCase()??"neutral"}`}>{complaintClassificationLabel(r.classification)}</span></td>
     <td data-column-key="status"><span className={`badge ${r.status==="DRAFT"?"neutral":r.status==="OPEN"?"open":"closed"}`}>{complaintStatusLabel(r.status)}</span></td>
     <td data-column-key="situation"><span className={`badge ${complaintOperationalSituationTone(situation)}`}>{complaintOperationalSituationLabel(situation)}</span></td>
     <td data-column-key="effectiveness"><span className={`badge ${efficacyTone(r.effectivenessStatus)}`}>{complaintEffectivenessLabel(r.effectivenessStatus)}</span></td>
     <td data-column-key="followup">{r.status!=="OPEN"?"—":<span className={followupState==="OVERDUE"?"badge nonconforming":followupState==="MISSING"?"badge warning":""}>{followupState==="MISSING"?"Sin fecha":formatDate(r.nextFollowupDate)}</span>}</td>
     <td data-column-key="closing">{formatDate(r.closedAt)}</td>
     <td data-column-key="related"><div className="relation-chips">{related.map(record=><Link key={record.id} className="relation-chip" href={qmsRecordHref(record.recordType,record.id)} title={qmsRecordTypeLabel(record.recordType)}>{qmsRecordDisplayCode(record,qmsRecordTypeLabel(record.recordType))}{!record.isActive?" · Anulado":""}</Link>)}{related.length===0?"—":null}</div></td>
    </tr>;
   }):<tr><td colSpan={complaintColumns.length+1} className="empty-state"><strong>No hay reclamaciones con estos filtros.</strong></td></tr>}
  </tbody></table></div></div>
 </section>;
}
