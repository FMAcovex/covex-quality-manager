import Link from "next/link";
import { getAuditList, type AuditListFilters } from "@/modules/audits/queries";
import { auditTypeLabels, auditScenarioLabels, auditStatusLabels, auditModalityLabels, auditQualityLabels, auditDate, auditSituation } from "@/modules/audits/domain";
import { criticalityLabels, isTerminalAction } from "@/modules/audits/finding-domain";
import { auditColumns } from "@/modules/audits/column-config";
import { ColumnSelector } from "@/components/column-selector";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { firstQueryValue, queryList } from "@/lib/qms/list-filters";
export const dynamic = "force-dynamic";
export default async function AuditsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  const filters: AuditListFilters = {};
  for (const key of ["year","type","scenario","department","status","modality","quality","criticality"] as const) filters[key] = queryList(query[key]);
  for (const key of ["q","administrative","plannedFrom","plannedTo","performedFrom","performedTo","page","findings","pendingActions","relatedDeviation","relatedCapa","nextReviewFrom","nextReviewTo"] as const) filters[key] = firstQueryValue(query[key]);
  const {rows,departments,years,total,page,pages} = await getAuditList(filters);
  const options = (labels: Record<string,string>) => Object.entries(labels).map(([value,label]) => ({value,label}));
  const pageHref = (next: number) => { const params = new URLSearchParams(); Object.entries(query).forEach(([k,v]) => { if (k !== "page") (Array.isArray(v) ? v : v ? [v] : []).forEach(x => params.append(k,x)); }); params.set("page",String(next)); return `/audits?${params}`; };
  return <section className="workspace audits-workspace"><div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Auditorías</h1><p>Expedientes, planificación, hallazgos y seguimiento.</p></div><div className="heading-actions"><Link className="button primary" href="/audits/new">+ Nueva auditoría</Link><ColumnSelector tableId="audit-list-table" storageKey="qms.columns.audits" columns={auditColumns}/></div></div>
    <form method="get" className="toolbar-form"><div className="filter-panel operational">
      <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative ?? ""}><option value="">Activos</option><option value="ANNULLED">Anulados</option><option value="ALL">Todos</option></select></label>
      <MultiSelectFilter name="year" label="Año" selected={filters.year ?? []} options={years.map(y => ({value:String(y),label:String(y)}))}/>
      <MultiSelectFilter name="type" label="Tipo" selected={filters.type ?? []} options={options(auditTypeLabels)}/>
      <MultiSelectFilter name="scenario" label="Escenario" selected={filters.scenario ?? []} options={options(auditScenarioLabels)}/>
      <MultiSelectFilter name="department" label="Departamento/Área" selected={filters.department ?? []} options={departments.map(d => ({value:d.id,label:`${d.code} · ${d.name}`}))}/>
      <MultiSelectFilter name="status" label="Estado" selected={filters.status ?? []} options={options(auditStatusLabels)}/>
      <MultiSelectFilter name="modality" label="Modalidad" selected={filters.modality ?? []} options={options(auditModalityLabels)}/>
      <MultiSelectFilter name="quality" label="Control" selected={filters.quality ?? []} options={options(auditQualityLabels)}/>
      <MultiSelectFilter name="criticality" label="Criticidad de hallazgos" selected={filters.criticality ?? []} options={options(criticalityLabels)}/>
      {[["findings","Con hallazgos"],["pendingActions","Con acciones pendientes"],["relatedDeviation","Con Desviación"],["relatedCapa","Con CAPA"]].map(([name,label]) => <label key={name} className="filter-placeholder"><span>{label}</span><select name={name} defaultValue={String(filters[name as keyof AuditListFilters] ?? "")}><option value="">Todos</option><option value="yes">Sí</option><option value="no">No</option></select></label>)}
      {[["nextReviewFrom","Próxima revisión desde"],["nextReviewTo","Próxima revisión hasta"],["plannedFrom","Prevista desde"],["plannedTo","Prevista hasta"],["performedFrom","Realizada desde"],["performedTo","Realizada hasta"]].map(([name,label]) => <label className="filter-placeholder" key={name}><span>{label}</span><input type="date" name={name} defaultValue={String(filters[name as keyof AuditListFilters] ?? "")}/></label>)}
      <div className="filter-actions"><button className="button small">Aplicar</button><Link className="button small" href="/audits">Limpiar</Link></div>
    </div><div className="search-row"><SearchAutocomplete placeholder="Código, objeto, alcance, referencia, entidad, participante o departamento…" defaultValue={filters.q} suggestions={rows.map(r => ({id:r.id,href:`/audits/${r.id}`,code:qmsRecordDisplayCode(r.qmsRecord),title:r.title ?? "Auditoría",searchText:[r.title,r.scope,r.externalReference,r.auditedEntityName,r.entityCode,...r.participants.map(p => p.displayName),...r.departments.map(d => d.departmentNameSnapshot)].join(" ")}))}/><button className="button">Buscar</button></div></form>
    <p>{total} expedientes · página {page} de {pages}</p>
    <div className="table-wrap"><table id="audit-list-table" className="data-table"><thead><tr>{auditColumns.map(c => <th key={c.key} data-column-key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map(r => {
      const cells = {
        control: <span className="badge">{auditQualityLabels[r.dataQualityStatus]}</span>, review: <span className="muted-note" title="Review se incorporará en R3C">—</span>, code: <Link href={`/audits/${r.id}`}>{qmsRecordDisplayCode(r.qmsRecord, "Sin código")}</Link>,
        type: r.auditType ? auditTypeLabels[r.auditType] : "—", scenario: r.scenario ? auditScenarioLabels[r.scenario] : "—", title: <Link href={`/audits/${r.id}`}>{r.title || "Sin objeto"}</Link>, area: r.scenario === "SUPPLIER" ? r.auditedEntityName : r.departments.map(d => d.departmentCodeSnapshot).join(", ") || "COVEX",
        planned: auditDate(r.plannedDate), performed: auditDate(r.performedDate), status: auditStatusLabels[r.status], situation: auditSituation(r), modality: r.modality ? auditModalityLabels[r.modality] : "—", team: r.participants.filter(p => p.role !== "AUDITEE").map(p => p.displayName).join(", "), scope: r.scope, opening: auditDate(r.openedAt), closing: auditDate(r.closedAt), reference: r.externalReference,
        findings: String(r.findings.filter(f => f.findingType !== "RECOMMENDATION").length), critical: String(r.findings.filter(f => f.criticality === "CRITICAL").length), major: String(r.findings.filter(f => f.criticality === "MAJOR").length), minor: String(r.findings.filter(f => f.criticality === "MINOR").length), recommendations: String(r.findings.filter(f => f.findingType === "RECOMMENDATION").length), pendingActions: String(r.findings.reduce((n,f) => n + f.actions.filter(a => !isTerminalAction(a.status)).length,0)), derivedRecords: String(r.qmsRecord._count.sourceRelations), nextReview: auditDate(r.followups[0]?.nextReviewDate),
      }; return <tr key={r.id}>{auditColumns.map(c => <td key={c.key} data-column-key={c.key}>{cells[c.key as keyof typeof cells] || "—"}</td>)}</tr>;
    })}</tbody></table>{!rows.length ? <p className="empty-state">No hay auditorías con estos filtros.</p> : null}</div>
    <nav className="heading-actions" aria-label="Paginación">{page > 1 ? <Link className="button small" href={pageHref(page-1)}>Anterior</Link> : null}{page < pages ? <Link className="button small" href={pageHref(page+1)}>Siguiente</Link> : null}</nav>
  </section>;
}
