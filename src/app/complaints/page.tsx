import { SavedViews } from "@/components/saved-views";
import { listSavedViews } from "@/lib/saved-views/queries";
import { canPresentRecord } from "@/lib/auth/presentation";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { ReviewListFilter, ReviewListIndicator } from "@/components/review/review-list-controls";
import Link from "next/link";
import { qmsListingUrl, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
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
import { activeFilterChips, appendFilterValues, firstQueryValue, queryList, type FilterDefinition } from "@/lib/qms/list-filters";
import { ListFilterToolbar } from "@/components/list-filter-toolbar";
import { reviewFilterOptions } from "@/lib/qms/review/list-domain";
import { AssignedListFilter } from "@/components/assigned-list-filter";
import { assignedFilterOptions } from "@/lib/qms/assigned";
import { versionLabel } from "@/lib/qms/versioning";

export const dynamic="force-dynamic";
const p=firstQueryValue;

const administrativeOptions=[{value:"ANNULLED",label:"Anulados"},{value:"ALL",label:"Todos"}];
const typeOptions=[{value:"CUSTOMER",label:"De cliente"},{value:"PROVIDER",label:"A proveedor"}];
const classificationOptions=[{value:"CRITICAL",label:"Crítica"},{value:"MAJOR",label:"Mayor"},{value:"MINOR",label:"Menor"},{value:"NO_GMP_IMPACT",label:"Sin impacto GMP"}];
const statusOptions=[{value:"DRAFT",label:"Borrador"},{value:"OPEN",label:"Abierta"},{value:"CLOSED",label:"Cerrada"}];
const situationOptions=[
 {value:"PART_I",label:"Parte I en curso"},{value:"PART_II_DECISION_PENDING",label:"Pendiente Parte II"},
 {value:"PART_I_CLOSURE_PENDING",label:"Pendiente cierre Parte I"},{value:"PART_II",label:"Parte II / seguimiento"},
 {value:"EFFECTIVENESS_PENDING",label:"Pendiente eficacia"},{value:"EFFECTIVENESS_NONCONFORMING",label:"Eficacia no conforme"}
];
const effectivenessOptions=[{value:"PENDING",label:"Pendiente"},{value:"ACCEPTABLE",label:"Conforme"},{value:"NOT_ACCEPTABLE",label:"No conforme"},{value:"NOT_REQUIRED",label:"N/A"}];
const followupOptions=[{value:"OVERDUE",label:"Vencido"},{value:"PENDING",label:"Pendiente"},{value:"MISSING",label:"Sin fecha"}];
const recurrentOptions=[{value:"YES",label:"Sí"},{value:"NO",label:"No"}];
const capaOptions=[{value:"YES",label:"Con CAPA"},{value:"NO",label:"Sin CAPA"}];
const returnsOptions=[{value:"YES",label:"Con devolución"},{value:"NO",label:"Sin devolución"}];
const option=(options:{value:string;label:string}[])=>options.map((item)=><option key={item.value} value={item.value}>{item.label}</option>);

function efficacyTone(value:string){
 if(value==="ACCEPTABLE")return "conforming";
 if(value==="NOT_ACCEPTABLE")return "nonconforming";
 if(value==="PENDING")return "warning";
 return "neutral";
}

async function ComplaintsPageAuthenticatedContent({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
  const toDetail = (id: string) => qmsWithReturnTo("/complaints/" + id, "/complaints", qmsListingUrl("/complaints", q));
 const filters={page:p(q.page),recurrent:p(q.recurrent),capa:p(q.capa),returns:p(q.returns),review:p(q.review),assigned:p(q.assigned),
  q:p(q.q),administrative:p(q.administrative),year:queryList(q.year),department:queryList(q.department),
  type:queryList(q.type),status:queryList(q.status),classification:queryList(q.classification),
  effectiveness:queryList(q.effectiveness),situation:queryList(q.situation),followup:queryList(q.followup)
 };
 const savedViews = await listSavedViews("/complaints");
 const {rows,departments,years,counters,pagination}=await getComplaintList(filters);
 const officialTemplateReady=await isActiveTemplateAssetReady(QmsRecordType.COMPLAINT,DocumentType.COMPLAINT_ANNEX_V);
 const exportParams=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>appendFilterValues(exportParams,k,v));
 const pageHref=(page:number)=>{const params=new URLSearchParams(exportParams);params.set("page",String(page));return `/complaints?${params}`;};
 const currentYear=filters.year[0]??String(new Date().getFullYear());
 const today=new Date();
 const yearOptions=years.map((y)=>({value:String(y),label:String(y)}));
 const departmentOptions=departments.map((d)=>({value:d.id,label:d.code}));
 const filterDefinitions:FilterDefinition[]=[
  {name:"administrative",label:"Estado administrativo",options:administrativeOptions},
  {name:"year",label:"Año",options:yearOptions},
  {name:"department",label:"Departamento",options:departmentOptions},
  {name:"type",label:"Tipo",options:typeOptions},
  {name:"classification",label:"Clasificación",options:classificationOptions},
  {name:"status",label:"Estado",options:statusOptions},
  {name:"situation",label:"Situación",options:situationOptions},
  {name:"effectiveness",label:"Eficacia",options:effectivenessOptions},
  {name:"followup",label:"Seguimiento",options:followupOptions},
  {name:"recurrent",label:"Recurrente",options:recurrentOptions},
  {name:"capa",label:"CAPA vinculada",options:capaOptions},
  {name:"returns",label:"Devolución vinculada",options:returnsOptions},
  {name:"review",label:"Revisión",options:reviewFilterOptions},
  {name:"assigned",label:"Asignación",options:assignedFilterOptions},
 ];

 return <section className="workspace qms-list-ux-b list-ux-c">
  <div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Reclamaciones</h1><p>Registro, investigación, resolución, seguimiento, eficacia y cierre.</p></div>
   <div className="heading-actions"><PermissionGate permission="CREATE" module="COMPLAINT"><Link href="/complaints/new" className="button primary">+ Nueva reclamación</Link></PermissionGate><ColumnSelector tableId="complaint-list-table" storageKey="qms.columns.complaints.r1" columns={[...complaintColumns]}/>
    <PermissionGate permission="EXPORT"><details className="export-menu"><summary className="button">Exportar ▾</summary><div className="export-popover"><strong>Exportaciones</strong>{officialTemplateReady?<PermissionGate permission="EXPORT"><a className="export-link" href={`/api/complaints/export/annex-v?year=${currentYear}`}>Anexo V oficial · año {currentYear}</a></PermissionGate>:<span className="template-missing-note">Anexo V bloqueado · plantilla oficial pendiente de cargar.</span>}<PermissionGate permission="EXPORT"><a className="export-link" href={`/api/complaints/export/simple?${exportParams.toString()}`}>Listado simple · filtros actuales</a></PermissionGate><PermissionGate permission="EXPORT"><a className="export-link" href={`/api/complaints/export/simple?year=${currentYear}`}>Listado simple · año {currentYear}</a></PermissionGate></div></details></PermissionGate>
   </div>
  </div>

  <div className="tabs"><Link className="tab active" href="/complaints">Expedientes</Link><Link className="tab muted" href="/complaints/indicators">Indicadores</Link></div>

  <form method="get" className="toolbar-form">
   <ListFilterToolbar
     storageKey="qms.filters.complaints"
     clearHref="/complaints"
     chips={activeFilterChips("/complaints", q, filterDefinitions)}
     views={<SavedViews listPath="/complaints" views={savedViews} />}
     search={<SearchAutocomplete
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
    })}
   />}
   >
   <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative??""}><option value="">Activos</option>{option(administrativeOptions)}</select></label>
   <MultiSelectFilter name="year" label="Año" selected={filters.year} options={yearOptions}/>
   <MultiSelectFilter name="department" label="Departamento" selected={filters.department} options={departmentOptions}/>
   <MultiSelectFilter name="type" label="Tipo" selected={filters.type} options={typeOptions}/>
   <MultiSelectFilter name="classification" label="Clasificación" selected={filters.classification} options={classificationOptions}/>
   <MultiSelectFilter name="status" label="Estado" selected={filters.status} options={statusOptions}/>
   <MultiSelectFilter name="situation" label="Situación" selected={filters.situation} options={situationOptions}/>
   <MultiSelectFilter name="effectiveness" label="Eficacia" selected={filters.effectiveness} options={effectivenessOptions}/>
   <MultiSelectFilter name="followup" label="Seguimiento" selected={filters.followup} options={followupOptions}/>
   <label className="filter-placeholder"><span>Recurrente</span><select name="recurrent" defaultValue={filters.recurrent??""}><option value="">Todas</option>{option(recurrentOptions)}</select></label>
   <label className="filter-placeholder"><span>CAPA vinculada</span><select name="capa" defaultValue={filters.capa??""}><option value="">Todas</option>{option(capaOptions)}</select></label>
   <label className="filter-placeholder"><span>Devolución vinculada</span><select name="returns" defaultValue={filters.returns??""}><option value="">Todas</option>{option(returnsOptions)}</select></label>
   <ReviewListFilter value={filters.review} />
   <AssignedListFilter value={filters.assigned} />
   </ListFilterToolbar>
  </form>

  <p className="list-counters">
   <span><strong>{counters.total}</strong> operativas</span>
   <span><strong>{counters.drafts}</strong> borradores</span>
   <span><strong>{counters.open}</strong> abiertas</span>
   <span><strong>{counters.pendingPartII}</strong> pendientes Parte II</span>
   <span><strong>{counters.pendingEfficacy}</strong> con eficacia pendiente</span>
   <span><strong>{counters.followupDue}</strong> seguimientos vencidos</span>
  </p>

  <PermissionGate permission="FOLLOWUP"><ManualReminderToolbar tableId="complaint-list-table" moduleLabel="Reclamaciones" hideWhenEmpty /></PermissionGate>

  <div className="table-card"><div className="table-scroll"><table id="complaint-list-table"><thead><tr><th className="reminder-select-column" aria-label="Seleccionar"><PermissionGate permission="FOLLOWUP"><input type="checkbox" data-reminder-select-all="true" aria-label="Seleccionar todas las reclamaciones visibles"/></PermissionGate></th>{complaintColumns.map(c=><th key={c.key} data-column-key={c.key}>{c.label}</th>)}</tr></thead><tbody>
   {rows.length?rows.map(r=>{
    const situation=complaintOperationalSituation(r);
    const followupState=complaintFollowupState(r,today);
    const currentVersion=r.qmsRecord.versions[0]?.sequenceNumber;
    const related=[...r.qmsRecord.sourceRelations.map(x=>x.targetRecord),...r.qmsRecord.targetRelations.map(x=>x.sourceRecord)];
    return <tr key={r.id} className={followupState==="OVERDUE"?"complaint-followup-overdue":undefined}>
     <td className="reminder-select-column"><PermissionGate permission="FOLLOWUP" allowed={canPresentRecord("COMPLAINT", "FOLLOWUP", { id: r.qmsRecord.id, departmentIds: r.departmentId ? [r.departmentId] : [] })}><input type="checkbox" data-reminder-record="true" data-reminder-id={r.qmsRecord.id} data-reminder-code={qmsRecordDisplayCode(r.qmsRecord)} data-reminder-summary={r.description??r.partyName??"Sin descripción"} data-reminder-status={complaintOperationalSituationLabel(situation)} data-reminder-meta={r.departmentCodeSnapshot??""} data-reminder-href={toDetail(r.id)} aria-label={`Seleccionar ${r.qmsRecord.businessCode??"reclamación"}`}/></PermissionGate></td>
     <td data-column-key="control">{r.dataQualityStatus!=="COMPLETE"?<span className="control-flag">⚠ Revisar</span>:"—"}</td><td data-column-key="review"><ReviewListIndicator counts={r.reviewCounts} basePath={`/complaints/${r.id}`} /></td>
     <td data-column-key="code"><Link className="summary-link" href={toDetail(r.id)}>{qmsRecordDisplayCode(r.qmsRecord)}</Link>{!r.qmsRecord.isActive?<span className="badge neutral">Anulado</span>:null}</td>
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
 <nav className="heading-actions" aria-label="Paginación de reclamaciones"><span>{pagination.total} resultados · Página {pagination.page} de {pagination.pageCount}</span>{pagination.page>1?<Link className="button small" href={pageHref(pagination.page-1)}>Anterior</Link>:null}{pagination.page<pagination.pageCount?<Link className="button small" href={pageHref(pagination.page+1)}>Siguiente</Link>:null}</nav>
 </section>;
}

export default async function ComplaintsPage(...args: Parameters<typeof ComplaintsPageAuthenticatedContent>) {
  return authorizedPage("src/app/complaints/page.tsx", () => ComplaintsPageAuthenticatedContent(...args), args);
}
