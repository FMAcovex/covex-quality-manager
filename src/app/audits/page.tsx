import { SavedViews } from "@/components/saved-views";
import { ListPagination } from "@/components/qms-list-pagination";
import { listSavedViews } from "@/lib/saved-views/queries";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { ReviewListFilter, ReviewListIndicator } from "@/components/review/review-list-controls";
import Link from "next/link";
import { listAnnualPlans } from "@/modules/audits/plans";
import { getAuditList, type AuditListFilters } from "@/modules/audits/queries";
import { auditStatusBadgeClass, auditTypeLabels, auditScenarioLabels, auditStatusLabels, auditModalityLabels, auditQualityLabels, auditDate, auditSituation, receivedAuditScenario } from "@/modules/audits/domain";
import { criticalityLabels, isTerminalAction } from "@/modules/audits/finding-domain";
import { auditColumns } from "@/modules/audits/column-config";
import { ColumnSelector } from "@/components/column-selector";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { auditWithReturnTo } from "@/modules/audits/navigation";
import { pendingAuditReviewDate } from "@/modules/audits/followup-review";
import { activeFilterChips, firstQueryValue, queryList, type FilterDefinition } from "@/lib/qms/list-filters";
import { ListFilterToolbar } from "@/components/list-filter-toolbar";
import { reviewFilterOptions } from "@/lib/qms/review/list-domain";
import { AssignedListFilter } from "@/components/assigned-list-filter";
import { assignedFilterOptions } from "@/lib/qms/assigned";
export const dynamic = "force-dynamic";
const administrativeOptions = [{ value: "ANNULLED", label: "Anulados" }, { value: "ALL", label: "Todos" }];
const planningOptions = [{ value: "PLANNED", label: "En plan anual" }, { value: "OUT_OF_PLAN", label: "Fuera de plan" }, { value: "UNCLASSIFIED", label: "Pendiente de clasificación" }];
const yesNoOptions = [{ value: "yes", label: "Sí" }, { value: "no", label: "No" }];
const yesNoFilters = [["findings", "Con hallazgos"], ["pendingActions", "Con acciones pendientes"], ["relatedDeviation", "Con Desviación"], ["relatedCapa", "Con CAPA"]] as const;
const dateFilters = [["nextReviewFrom", "Próxima revisión desde"], ["nextReviewTo", "Próxima revisión hasta"], ["plannedFrom", "Prevista desde"], ["plannedTo", "Prevista hasta"], ["performedFrom", "Realizada desde"], ["performedTo", "Realizada hasta"]] as const;
const choiceFilters = [
  ["report", "Informe", [{ value: "pending", label: "Pendiente" }, { value: "issued", label: "Emitido" }]],
  ["signedPdf", "PDF firmado", [{ value: "yes", label: "Con PDF" }, { value: "no", label: "Sin PDF" }]],
  ["situation", "Situación", [{ value: "followup", label: "En seguimiento" }, { value: "partial", label: "Cierre parcial" }, { value: "closed", label: "Cerrada" }]],
] as const;
const isoDate = (value: string) => value.split("-").reverse().join("/");
async function AuditsPageAuthenticatedContent({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const filters: AuditListFilters = {};
  for (const key of ["year","type","scenario","department","status","modality","quality","criticality"] as const) filters[key] = queryList(query[key]);
  for (const key of ["q","administrative","plannedFrom","plannedTo","performedFrom","performedTo","page","findings","pendingActions","relatedDeviation","relatedCapa","nextReviewFrom","nextReviewTo","review","assigned","report","signedPdf","situation","planning","planId"] as const) filters[key] = firstQueryValue(query[key]);
  const savedViews = await listSavedViews("/audits");
  const [{rows,departments,years,total,page,pages,errors},annualPlans] = await Promise.all([getAuditList(filters),listAnnualPlans()]);
  const listParams = new URLSearchParams();
  Object.entries(query).forEach(([key, values]) => (Array.isArray(values) ? values : values ? [values] : []).forEach(value => listParams.append(key, value)));
  const returnTo = listParams.toString() ? "/audits?" + listParams : "/audits";
  const toDetail = (id: string) => auditWithReturnTo("/audits/" + id, returnTo);
  const options = (labels: Record<string,string>) => Object.entries(labels).map(([value,label]) => ({value,label}));
  const pageHref = (next: number) => { const params = new URLSearchParams(); Object.entries(query).forEach(([k,v]) => { if (k !== "page") (Array.isArray(v) ? v : v ? [v] : []).forEach(x => params.append(k,x)); }); params.set("page",String(next)); return `/audits?${params}`; };
  const selectedType = filters.type?.length === 1 ? filters.type[0] : "";
  const typeHref = (type: string) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, values]) => {
      if (key === "type" || key === "page") return;
      (Array.isArray(values) ? values : values ? [values] : []).forEach(value => params.append(key, value));
    });
    if (type) params.append("type", type);
    const suffix = params.toString();
    return suffix ? `/audits?${suffix}` : "/audits";
  };
  const typeTabs = [{type:"",label:"Todas las auditorías"},{type:"INTERNAL",label:"Internas"},{type:"EXTERNAL",label:"Externas"}];
  const planOptions = annualPlans.map(p => ({ value: p.id, label: `${p.year} · ${p.auditType==="INTERNAL"?"Interno":"Externo"} · ${p.title}` }));
  const yearOptions = years.map(y => ({ value: String(y), label: String(y) }));
  const departmentOptions = departments.map(d => ({ value: d.id, label: `${d.code} · ${d.name}` }));
  const filterDefinitions: FilterDefinition[] = [
    { name: "administrative", label: "Estado administrativo", options: administrativeOptions },
    { name: "planning", label: "Planificación", options: planningOptions },
    { name: "planId", label: "Plan anual", options: planOptions },
    { name: "year", label: "Año", options: yearOptions },
    { name: "type", label: "Tipo", options: options(auditTypeLabels) },
    { name: "scenario", label: "Escenario", options: options(auditScenarioLabels) },
    { name: "department", label: "Departamento/Área", options: departmentOptions },
    { name: "status", label: "Estado", options: options(auditStatusLabels) },
    { name: "modality", label: "Modalidad", options: options(auditModalityLabels) },
    { name: "quality", label: "Calidad del dato", options: options(auditQualityLabels) },
    { name: "criticality", label: "Criticidad de hallazgos", options: options(criticalityLabels) },
    ...yesNoFilters.map(([name, label]) => ({ name, label, options: yesNoOptions })),
    ...dateFilters.map(([name, label]) => ({ name, label, options: [], format: isoDate })),
    { name: "review", label: "Revisión", options: reviewFilterOptions },
    { name: "assigned", label: "Asignación", options: assignedFilterOptions },
    ...choiceFilters.map(([name, label, choices]) => ({ name, label, options: choices })),
  ];
  return <section className="workspace audits-workspace qms-list-ux-b list-ux-c"><div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Auditorías</h1><p>Expedientes, planificación, hallazgos y seguimiento.</p></div><div className="heading-actions"><Link className="button" href="/audits/plans">Planes anuales</Link><PermissionGate permission="CREATE" module="AUDIT"><Link className="button primary" href="/audits/new">+ Nueva auditoría</Link></PermissionGate><ColumnSelector tableId="audit-list-table" storageKey="qms.columns.audits" columns={auditColumns}/></div></div>
    <nav className="audit-type-nav" aria-label="Filtrar auditorías por tipo">{typeTabs.map(tab => <Link key={tab.type} className={`audit-type-option ${selectedType === tab.type ? "active" : ""}`} aria-current={selectedType === tab.type ? "page" : undefined} href={typeHref(tab.type)}>{tab.label}</Link>)}</nav>
    {errors.length > 0 && <p className="form-errors" role="alert">{errors.join(" ")}</p>}
    <form method="get" className="toolbar-form">
      <ListFilterToolbar
        storageKey="qms.filters.audits"
        clearHref="/audits"
        chips={activeFilterChips("/audits", query, filterDefinitions)}
        views={<SavedViews listPath="/audits" views={savedViews} />}
        search={<SearchAutocomplete placeholder="Código, objeto, alcance, referencia, entidad, participante o departamento…" defaultValue={filters.q} suggestions={rows.map(r => ({id:r.id,href:toDetail(r.id),code:qmsRecordDisplayCode(r.qmsRecord),title:r.title ?? "Auditoría",searchText:[r.title,r.scope,r.externalReference,r.auditedEntityName,r.entityCode,...r.participants.map(p => p.displayName),...r.departments.map(d => d.departmentNameSnapshot)].join(" ")}))}/>}
      >
      <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative ?? ""}><option value="">Activos</option>{administrativeOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label className="filter-placeholder"><span>Planificación</span><select name="planning" defaultValue={filters.planning??""}><option value="">Todas</option>{planningOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <label className="filter-placeholder"><span>Plan anual</span><select name="planId" defaultValue={filters.planId??""}><option value="">Todos los planes</option>{planOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      <MultiSelectFilter name="year" label="Año" selected={filters.year ?? []} options={yearOptions}/>
      <MultiSelectFilter name="type" label="Tipo" selected={filters.type ?? []} options={options(auditTypeLabels)}/>
      <MultiSelectFilter name="scenario" label="Escenario" selected={filters.scenario ?? []} options={options(auditScenarioLabels)}/>
      <MultiSelectFilter name="department" label="Departamento/Área" selected={filters.department ?? []} options={departmentOptions}/>
      <MultiSelectFilter name="status" label="Estado" selected={filters.status ?? []} options={options(auditStatusLabels)}/>
      <MultiSelectFilter name="modality" label="Modalidad" selected={filters.modality ?? []} options={options(auditModalityLabels)}/>
      <MultiSelectFilter name="quality" label="Calidad del dato" selected={filters.quality ?? []} options={options(auditQualityLabels)}/>
      <MultiSelectFilter name="criticality" label="Criticidad de hallazgos" selected={filters.criticality ?? []} options={options(criticalityLabels)}/>
      {yesNoFilters.map(([name,label]) => <label key={name} className="filter-placeholder"><span>{label}</span><select name={name} defaultValue={String(filters[name] ?? "")}><option value="">Todos</option>{yesNoOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}
      {dateFilters.map(([name,label]) => <label className="filter-placeholder" key={name}><span>{label}</span><input type="date" name={name} defaultValue={String(filters[name] ?? "")}/></label>)}
      <ReviewListFilter value={filters.review}/><AssignedListFilter value={filters.assigned}/>{choiceFilters.map(([name,label,choices])=><label className="filter-placeholder" key={name}><span>{label}</span><select name={name} defaultValue={String(filters[name] ?? "")}><option value="">Todos</option>{choices.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}
      </ListFilterToolbar>
    </form>
    <p className="list-counters"><span><strong>{total}</strong> expedientes · página {page} de {pages}</span></p>
    <div className="table-wrap"><table id="audit-list-table"><thead><tr>{auditColumns.map(c => <th key={c.key} data-column-key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map(r => {
      const cells = {
        reportVersion: r.qmsRecord.versions[0]?String(r.qmsRecord.versions[0].sequenceNumber).padStart(2,"0"):receivedAuditScenario(r.scenario)?"No aplica":"Pendiente", reportDate:auditDate(r.reportDate),signedPdf:r.qmsRecord.versions[0]?.documents.length?"Disponible":"No disponible",partial:r.capaPlanEstablishedAt||r.reportSentAt?"Sí":"No",
        control: r.dataQualityStatus !== "COMPLETE" ? <span className="control-flag">⚠ {auditQualityLabels[r.dataQualityStatus]}</span> : "—", review: <ReviewListIndicator counts={r.reviewCounts} basePath={toDetail(r.id)}/>, code: <><Link className="summary-link" href={toDetail(r.id)}>{qmsRecordDisplayCode(r.qmsRecord, "Sin código")}</Link>{!r.qmsRecord.isActive ? <span className="badge neutral">Anulado</span> : null}</>,
        type: r.auditType ? auditTypeLabels[r.auditType] : "—", scenario: r.scenario ? auditScenarioLabels[r.scenario] : "—", title: <Link className="summary-link" href={toDetail(r.id)}>{r.title || "Sin objeto"}</Link>, area: r.scenario === "SUPPLIER" ? r.auditedEntityName : r.departments.map(d => d.departmentCodeSnapshot).join(", ") || "COVEX",
        planned: auditDate(r.plannedDate), performed: auditDate(r.performedDate), status: <span className={`badge ${auditStatusBadgeClass(r.status)}`}>{auditStatusLabels[r.status]}</span>, situation: auditSituation({...r,reportIssued:r.qmsRecord.versions.length>0}), modality: r.modality ? auditModalityLabels[r.modality] : "—", team: r.participants.filter(p => p.role !== "AUDITEE").map(p => p.displayName).join(", "), scope: r.scope, opening: auditDate(r.openedAt), closing: auditDate(r.closedAt), reference: r.externalReference,
        findings: String(r.findings.filter(f => f.findingType !== "RECOMMENDATION").length), critical: String(r.findings.filter(f => f.criticality === "CRITICAL").length), major: String(r.findings.filter(f => f.criticality === "MAJOR").length), minor: String(r.findings.filter(f => f.criticality === "MINOR").length), recommendations: String(r.findings.filter(f => f.findingType === "RECOMMENDATION").length), pendingActions: String(r.findings.reduce((n,f) => n + f.actions.filter(a => !isTerminalAction(a.status)).length,0)), derivedRecords: String(r.qmsRecord._count.sourceRelations), nextReview: auditDate(pendingAuditReviewDate(r.followups,new Set(r.findings.map(f=>f.id)))),
      }; return <tr key={r.id}>{auditColumns.map(c => <td key={c.key} data-column-key={c.key}>{cells[c.key as keyof typeof cells] || "—"}</td>)}</tr>;
    })}</tbody></table>{!rows.length ? <p className="empty-state">No hay auditorías con estos filtros.</p> : null}</div>
    <ListPagination total={total} page={page} pageCount={pages} pageSize={25} href={pageHref}/>
  </section>;
}

export default async function AuditsPage(...args: Parameters<typeof AuditsPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/page.tsx", () => AuditsPageAuthenticatedContent(...args), args);
}
