import { SavedViews } from "@/components/saved-views";
import { ListPagination } from "@/components/qms-list-pagination";
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
import { returnColumns } from "@/modules/returns/column-config";
import { formatDate,returnDecisionLabel,returnStatusLabel,returnTypeLabel } from "@/modules/returns/domain";
import { getReturnList } from "@/modules/returns/queries";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { ManualReminderToolbar } from "@/components/manual-reminder-toolbar";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { activeFilterChips, appendFilterValues, firstQueryValue, queryList, type FilterDefinition } from "@/lib/qms/list-filters";
import { ListFilterToolbar } from "@/components/list-filter-toolbar";
import { reviewFilterOptions } from "@/lib/qms/review/list-domain";
export const dynamic="force-dynamic";
const p=firstQueryValue;
const administrativeOptions=[{value:"ANNULLED",label:"Anulados"},{value:"ALL",label:"Todos"}];
const typeOptions=[{value:"COMMERCIAL",label:"Comercial"},{value:"COMPLAINT",label:"Reclamación"},{value:"RECALL",label:"Retirada"},{value:"EXPIRY",label:"Caducidad"},{value:"TRANSPORT",label:"Transporte"},{value:"OTHER",label:"Otra"}];
const decisionOptions=[{value:"PENDING",label:"Pendiente"},{value:"ACCEPTED",label:"Aceptada"},{value:"REJECTED",label:"Rechazada"}];
const statusOptions=[{value:"DRAFT",label:"Borrador"},{value:"OPEN",label:"Abierta"},{value:"CLOSED",label:"Cerrada"}];
const followupOptions=[{value:"DUE",label:"Vencido / hoy"},{value:"PLANNED",label:"Planificado"},{value:"MISSING",label:"Abierta sin fecha"}];
const complaintOptions=[{value:"YES",label:"Sí"},{value:"NO",label:"No"}];
const option=(options:{value:string;label:string}[])=>options.map((item)=><option key={item.value} value={item.value}>{item.label}</option>);
async function ReturnsPageAuthenticatedContent({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams; const toDetail=(id:string)=>qmsWithReturnTo("/returns/"+id,"/returns",qmsListingUrl("/returns",q)); const filters={page:p(q.page),followup:p(q.followup),complaint:p(q.complaint),review:p(q.review),q:p(q.q),administrative:p(q.administrative),year:queryList(q.year),department:queryList(q.department),type:queryList(q.type),status:queryList(q.status),decision:queryList(q.decision)};
 const savedViews = await listSavedViews("/returns");
 const {rows,departments,years,counters,page,pageSize,count}=await getReturnList(filters);const officialTemplateReady=await isActiveTemplateAssetReady(QmsRecordType.RETURN,DocumentType.RETURN_ANNEX_VI);const exportParams=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>appendFilterValues(exportParams,k,v));exportParams.delete("page");const pageHref=(next:number)=>{const p=new URLSearchParams(exportParams);p.set("page",String(next));return `/returns?${p}`;};const currentYear=filters.year[0]??String(new Date().getFullYear());
 const yearOptions=years.map((y)=>({value:String(y),label:String(y)}));
 const departmentOptions=departments.map((d)=>({value:d.id,label:d.code}));
 const filterDefinitions:FilterDefinition[]=[
  {name:"administrative",label:"Estado administrativo",options:administrativeOptions},
  {name:"year",label:"Año",options:yearOptions},
  {name:"department",label:"Área",options:departmentOptions},
  {name:"type",label:"Tipo",options:typeOptions},
  {name:"decision",label:"Decisión",options:decisionOptions},
  {name:"status",label:"Estado",options:statusOptions},
  {name:"followup",label:"Seguimiento",options:followupOptions},
  {name:"complaint",label:"Reclamación vinculada",options:complaintOptions},
  {name:"review",label:"Revisión",options:reviewFilterOptions},
 ];
 return <section className="workspace qms-list-ux-b list-ux-c"><div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Devoluciones</h1><p>Recepción, evaluación, decisión, destino final y trazabilidad.</p></div><div className="heading-actions"><PermissionGate permission="CREATE" module="RETURN"><Link href="/returns/new" className="button primary">+ Nueva devolución</Link></PermissionGate><ColumnSelector tableId="return-list-table" storageKey="qms.columns.returns" columns={[...returnColumns]}/><PermissionGate permission="EXPORT"><details className="export-menu"><summary className="button">Exportar ▾</summary><div className="export-popover"><strong>Exportaciones</strong>{officialTemplateReady?<PermissionGate permission="EXPORT"><a className="export-link" href={`/api/returns/export/annex-vi?year=${currentYear}`}>Anexo VI oficial · año {currentYear}</a></PermissionGate>:<span className="template-missing-note">Anexo VI bloqueado · plantilla oficial pendiente de cargar.</span>}<PermissionGate permission="EXPORT"><a className="export-link" href={`/api/returns/export/simple?${exportParams.toString()}`}>Listado simple · filtros actuales</a></PermissionGate><PermissionGate permission="EXPORT"><a className="export-link" href={`/api/returns/export/simple?year=${currentYear}`}>Listado simple · año {currentYear}</a></PermissionGate></div></details></PermissionGate></div></div>
 <div className="tabs"><Link className="tab active" href="/returns">Expedientes</Link><Link className="tab muted" href="/returns/indicators">Indicadores</Link></div>
 <form method="get" className="toolbar-form">
  <ListFilterToolbar
    storageKey="qms.filters.returns"
    clearHref="/returns"
    chips={activeFilterChips("/returns", q, filterDefinitions)}
    views={<SavedViews listPath="/returns" views={savedViews} />}
    search={<SearchAutocomplete
            defaultValue={filters.q ?? ""}
            placeholder="Buscar código, cliente, producto, lote, motivo o destino…"
            suggestions={rows.map((row) => ({
              id: row.id,
              href: toDetail(row.id),
              code: row.qmsRecord.businessCode ?? "Sin código",
              title: row.products[0]?.productNameCode ?? row.reasonObservations ?? "Sin descripción",
              meta: [row.departmentCodeSnapshot, returnStatusLabel(row.status)].filter(Boolean).join(" · "),
              searchText: [
                row.qmsRecord.businessCode,
                row.customerEntity,
                row.country,
                row.reasonObservations,
                row.finalDestination,
                ...row.products.flatMap((product) => [product.productNameCode, product.lot]),
              ].filter(Boolean).join(" "),
            }))}
          />}
  >
  <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative??""}><option value="">Activos</option>{option(administrativeOptions)}</select></label>
  <MultiSelectFilter name="year" label="Año" selected={filters.year} options={yearOptions}/>
  <MultiSelectFilter name="department" label="Área" selected={filters.department} options={departmentOptions}/>
  <MultiSelectFilter name="type" label="Tipo" selected={filters.type} options={typeOptions}/>
  <MultiSelectFilter name="decision" label="Decisión" selected={filters.decision} options={decisionOptions}/>
  <MultiSelectFilter name="status" label="Estado" selected={filters.status} options={statusOptions}/>
  <label className="filter-placeholder"><span>Seguimiento</span><select name="followup" defaultValue={filters.followup??""}><option value="">Todos</option>{option(followupOptions)}</select></label>
  <label className="filter-placeholder"><span>Reclamación vinculada</span><select name="complaint" defaultValue={filters.complaint??""}><option value="">Todas</option>{option(complaintOptions)}</select></label>
  <ReviewListFilter value={filters.review} />
  </ListFilterToolbar>
 </form>
 <p className="list-counters"><span><strong>{counters.total}</strong> operativas</span><span><strong>{counters.drafts}</strong> borradores</span><span><strong>{counters.open}</strong> abiertas</span><span><strong>{counters.pending}</strong> con decisión pendiente</span><span><strong>{counters.followupDue}</strong> seguimientos vencidos</span><span className="list-counters-note">Totales del módulo sin filtros. No incluyen anulados; los borradores se cuentan aparte.</span></p>
 <PermissionGate permission="FOLLOWUP"><ManualReminderToolbar tableId="return-list-table" moduleLabel="Devoluciones" hideWhenEmpty /></PermissionGate>
 <div className="table-card"><div className="table-scroll"><table id="return-list-table" className="change-table"><thead><tr><th className="reminder-select-column" aria-label="Seleccionar"><PermissionGate permission="FOLLOWUP"><input type="checkbox" data-reminder-select-all="true" aria-label="Seleccionar todas las devoluciones visibles" /></PermissionGate></th>{returnColumns.map(c=><th key={c.key} data-column-key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.length?rows.map(r=>{const first=r.products[0];const latest=r.followups[0];return <tr key={r.id}><td className="reminder-select-column"><PermissionGate permission="FOLLOWUP" allowed={canPresentRecord("RETURN", "FOLLOWUP", { id: r.qmsRecord.id, departmentIds: r.departmentId ? [r.departmentId] : [] })}><input type="checkbox" data-reminder-record="true" data-reminder-id={r.qmsRecord.id} data-reminder-code={qmsRecordDisplayCode(r.qmsRecord)} data-reminder-summary={first?.productNameCode??r.reasonObservations??"Sin descripción"} data-reminder-status={returnStatusLabel(r.status)} data-reminder-meta={r.departmentCodeSnapshot??""} data-reminder-href={toDetail(r.id)} aria-label={`Seleccionar ${r.qmsRecord.businessCode??"devolución"}`} /></PermissionGate></td><td data-column-key="control">{r.dataQualityStatus!=="COMPLETE"?<span className="control-flag">⚠ Revisar</span>:"—"}</td><td data-column-key="review"><ReviewListIndicator counts={r.reviewCounts} basePath={`/returns/${r.id}`} /></td><td data-column-key="code"><Link className="summary-link" href={toDetail(r.id)}>{qmsRecordDisplayCode(r.qmsRecord)}</Link>{!r.qmsRecord.isActive?<span className="badge neutral">Anulado</span>:null}</td><td data-column-key="status"><span className={`badge ${r.status==="DRAFT"?"neutral":r.status==="OPEN"?"open":"closed"}`}>{returnStatusLabel(r.status)}</span></td><td data-column-key="date">{formatDate(r.communicationDate)}</td><td data-column-key="related" className="table-cell-wrap">{r.relatedDocument??returnTypeLabel(r.returnType)}</td><td data-column-key="customer">{r.customerEntity??"—"}</td><td data-column-key="product" className="table-cell-wrap">{first?.productNameCode??"—"}{r.products.length>1?` (+${r.products.length-1})`:""}</td><td data-column-key="format">{first?.format??"—"}</td><td data-column-key="lot">{first?.lot??"—"}</td><td data-column-key="quantity">{first?.quantity??"—"}</td><td data-column-key="expiry">{first?.expiryReanalysis??"—"}</td><td data-column-key="country">{r.country??"—"}</td><td data-column-key="decision">{returnDecisionLabel(r.decision)}</td><td data-column-key="destination" className="table-cell-wrap">{r.finalDestination??"—"}</td><td data-column-key="destruction">{[r.destructionManagedBy,r.destructionCertificate].filter(Boolean).join(" · ")||"—"}</td><td data-column-key="followup">{latest?`${formatDate(latest.followupDate)} · ${latest.comment} · Próximo: ${formatDate(latest.nextFollowupDate)}`:"—"}</td><td data-column-key="qmsRelated"><div className="relation-chips">{[...r.qmsRecord.sourceRelations.map(x=>x.targetRecord),...r.qmsRecord.targetRelations.map(x=>x.sourceRecord)].map(record=><Link key={record.id} className="relation-chip" href={qmsRecordHref(record.recordType,record.id)} title={qmsRecordTypeLabel(record.recordType)}>{qmsRecordDisplayCode(record,qmsRecordTypeLabel(record.recordType))}{!record.isActive?" · Anulado":""}</Link>)}{r.qmsRecord.sourceRelations.length+r.qmsRecord.targetRelations.length===0?"—":null}</div></td></tr>}):<tr><td colSpan={19} className="empty-state"><strong>No hay devoluciones con estos filtros.</strong></td></tr>}</tbody></table></div></div><ListPagination total={count} page={page} pageCount={Math.ceil(count/pageSize)} pageSize={pageSize} href={pageHref}/></section>;
}

export default async function ReturnsPage(...args: Parameters<typeof ReturnsPageAuthenticatedContent>) {
  return authorizedPage("src/app/returns/page.tsx", () => ReturnsPageAuthenticatedContent(...args), args);
}
