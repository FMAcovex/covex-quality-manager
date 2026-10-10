import { ReviewListFilter, ReviewListIndicator } from "@/components/review/review-list-controls";
import Link from "next/link";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { isActiveTemplateAssetReady } from "@/modules/configuration/template-readiness";
import {
  capaStatusLabel,
  capaTypeLabel,
  effectivenessLabel,
  formatDate,
} from "@/modules/capa/domain";
import { getCapaList } from "@/modules/capa/queries";
import { ColumnSelector } from "@/components/column-selector";
import { capaColumns } from "@/modules/capa/column-config";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { ManualReminderToolbar } from "@/components/manual-reminder-toolbar";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { appendFilterValues, firstQueryValue, queryList } from "@/lib/qms/list-filters";

export const dynamic = "force-dynamic";

const param = firstQueryValue;

export default async function CapaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = {
    review: firstQueryValue(query.review),
    q: param(query.q),
    administrative: param(query.administrative),
    year: queryList(query.year),
    department: queryList(query.department),
    type: queryList(query.type),
    status: queryList(query.status),
    effectiveness: queryList(query.effectiveness),
    origin: queryList(query.origin),
    followup: param(query.followup),
  };
  const { rows, departments, years, origins, counters } = await getCapaList(filters);
  const officialTemplateReady = await isActiveTemplateAssetReady(QmsRecordType.CAPA, DocumentType.CAPA_ANNEX_IV);

  const exportParams = new URLSearchParams();
  Object.entries(filters).forEach(([key,value]) => {
    if(key !== "q" && key !== "followup") appendFilterValues(exportParams,key,value);
  });


  return (
    <section className="workspace qms-list-ux-b">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sistema de Calidad</p>
          <h1>CAPA</h1>
          <p>Acciones correctivas y preventivas · seguimiento, eficacia y cierre.</p>
        </div>
        <div className="heading-actions">
          <Link href="/capa/new" className="button primary">+ Nueva CAPA</Link>
          <ColumnSelector tableId="capa-list-table" storageKey="qms.columns.capa" columns={[...capaColumns]} />
          <details className="export-menu">
            <summary className="button">Exportar ▾</summary>
            <div className="export-popover">
              <strong>Exportaciones CAPA</strong>
              <form action="/api/capa/export/annex-iv" method="get" className="export-year-form">
                <label><span>Anexo IV oficial</span><select name="year" defaultValue={filters.year[0] ?? String(new Date().getFullYear())}>
                  {Array.from(new Set([Number(filters.year ?? new Date().getFullYear()),...years])).filter(Number.isInteger).sort((a,b)=>b-a).map((year)=><option key={year} value={year}>{year}</option>)}
                </select></label>
                {officialTemplateReady ? <button className="button small" type="submit">Descargar</button> : <><button className="button small" type="button" disabled>Descargar</button><span className="template-missing-note">Plantilla oficial pendiente de cargar.</span></>}
              </form>
              <a className="export-link" href={`/api/capa/export/simple?${exportParams.toString()}`}>Listado simple · filtros actuales</a>
              <a className="export-link" href="/api/capa/export/simple">Listado simple completo</a>
            </div>
          </details>
        </div>
      </div>

      <div className="tabs">
        <Link className="tab active" href="/capa">Expedientes</Link>
        <Link className="tab muted" href="/capa/indicators">Indicadores</Link>
      </div>

      <form method="get" className="toolbar-form">
        <div className="filter-panel operational capa-filters">
          <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative ?? ""}><option value="">Activos</option><option value="ANNULLED">Anulados</option><option value="ALL">Todos</option></select></label>
          <MultiSelectFilter name="year" label="Año" selected={filters.year} options={years.map((year)=>({value:String(year),label:String(year)}))} />
          <MultiSelectFilter name="department" label="Departamento" selected={filters.department} options={departments.map((d)=>({value:d.id,label:d.code}))} />
          <MultiSelectFilter name="type" label="Tipo" selected={filters.type} options={[{value:"CORRECTIVE",label:"Correctiva"},{value:"PREVENTIVE",label:"Preventiva"}]} />
          <MultiSelectFilter name="status" label="Estado" selected={filters.status} options={[{value:"DRAFT",label:"Borrador"},{value:"OPEN",label:"Abierta"},{value:"CLOSED",label:"Cerrada"},{value:"CANCELLED",label:"Cancelada"}]} />
          <MultiSelectFilter name="effectiveness" label="Eficacia" selected={filters.effectiveness} options={[{value:"PENDING",label:"Pendiente"},{value:"CONFORMING",label:"Conforme"},{value:"NONCONFORMING",label:"No conforme"},{value:"NA",label:"N/A histórico"}]} />
          <MultiSelectFilter name="origin" label="Origen" selected={filters.origin} options={origins.map((value)=>({value,label:value}))} />
          <label className="filter-placeholder"><span>Seguimiento</span><select name="followup" defaultValue={filters.followup ?? ""}><option value="">Todos</option><option value="due">Vencido</option><option value="scheduled">Programado</option><option value="none">Sin próxima fecha</option></select></label>
          <ReviewListFilter value={filters.review} /><div className="filter-actions"><button className="button small" type="submit">Aplicar</button><Link className="button small" href="/capa">Limpiar</Link></div>
        </div>
        <div className="search-row">
          <SearchAutocomplete
            defaultValue={filters.q ?? ""}
            placeholder="Buscar código, origen, acción, causa raíz u observaciones…"
            suggestions={rows.map((row) => ({
              id: row.id,
              href: `/capa/${row.id}`,
              code: row.qmsRecord.businessCode ?? "Sin código",
              title: row.plannedActions[0]?.description ?? row.defectDescription ?? "Sin descripción",
              meta: [row.departmentCodeSnapshot, capaStatusLabel(row.status)].filter(Boolean).join(" · "),
              searchText: [
                row.qmsRecord.businessCode,
                row.originCode,
                row.originType,
                ...row.qmsRecord.targetRelations.map((relation) => relation.sourceRecord.businessCode),
                row.defectDescription,
                row.rootCause,
                row.internalObservations,
                ...row.plannedActions.map((action) => action.description),
              ].filter(Boolean).join(" "),
            }))}
          />
          <button className="button" type="submit">Buscar</button>
        </div>
      </form>

      <div className="summary-strip">
        <div><span>Total operativas</span><strong>{counters.total}</strong></div>
        <div><span>Borradores</span><strong>{counters.drafts}</strong></div>
        <div><span>Abiertas</span><strong>{counters.open}</strong></div>
        <div><span>Cerradas · eficacia pendiente</span><strong>{counters.pendingEfficacy}</strong></div>
        <div><span>Seguimiento vencido</span><strong>{counters.overdueFollowups}</strong></div>
      </div>

      <ManualReminderToolbar tableId="capa-list-table" moduleLabel="CAPA" />

      <div className="table-card">
        <div className="table-scroll">
          <table id="capa-list-table" className="records-table capa-table">
            <thead>
              <tr>
<th className="reminder-select-column" aria-label="Seleccionar"><input type="checkbox" data-reminder-select-all="true" aria-label="Seleccionar todas las CAPA visibles" /></th><th data-column-key="control">Control</th><th data-column-key="review">Revisión</th><th data-column-key="type">Tipo</th><th data-column-key="code">Código</th><th data-column-key="department">Departamento</th><th data-column-key="origin">Origen</th><th data-column-key="originCode">Código origen</th><th data-column-key="description">Descripción CAPA</th><th data-column-key="opening">Apertura</th><th data-column-key="planned">Fecha prevista</th><th data-column-key="status">Estado</th><th data-column-key="operationalClose">Cierre y ejecución</th><th data-column-key="effectiveness">Eficacia</th><th data-column-key="latestFollowup">Último seguimiento</th><th data-column-key="nextFollowup">Próximo seguimiento</th><th data-column-key="effectiveClose">Verificación final</th><th data-column-key="related">Relacionados</th><th data-column-key="observations">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const currentVersion = row.qmsRecord.versions[0] ?? null;
                const originRecords = row.qmsRecord.targetRelations
                  .filter((item) => item.relationType === "GENERATES" && (item.sourceRecord.recordType === "DEVIATION" || item.sourceRecord.recordType === "COMPLAINT" || item.sourceRecord.recordType === "AUDIT"))
                  .map((item) => item.sourceRecord);
                const plannedDates = row.plannedActions
                  .map((item) => item.plannedExecutionDate)
                  .filter((value): value is Date => Boolean(value));
                const plannedDate = plannedDates.length
                  ? new Date(Math.max(...plannedDates.map((value) => value.getTime())))
                  : null;
                const actionDescription = row.plannedActions.length
                  ? row.plannedActions.map((item) => item.description).join(" · ")
                  : "—";
                return (
                  <tr key={row.id}>
                    <td className="reminder-select-column">
                      <input
                        type="checkbox"
                        data-reminder-record="true"
                        data-reminder-id={row.qmsRecord.id}
                        data-reminder-code={qmsRecordDisplayCode(row.qmsRecord)}
                        data-reminder-summary={actionDescription}
                        data-reminder-status={capaStatusLabel(row.status)}
                        data-reminder-meta={row.departmentCodeSnapshot ?? ""}
                        data-reminder-href={`/capa/${row.id}`}
                        aria-label={`Seleccionar ${row.qmsRecord.businessCode ?? "CAPA"}`}
                      />
                    </td>
                    <td data-column-key="control">{row.dataQualityStatus !== "COMPLETE" ? <span className="control-flag">⚠ {row.dataQualityStatus === "INCOMPLETE" ? "Incompleto" : "Revisar"}</span> : "—"}</td><td data-column-key="review"><ReviewListIndicator counts={row.reviewCounts} basePath={`/capa/${row.id}`} /></td>
                    <td data-column-key="type"><span className="badge neutral">{capaTypeLabel(row.actionType)}</span></td>
                    <td data-column-key="code" className="sticky-code"><Link href={`/capa/${row.id}`}><strong>{qmsRecordDisplayCode(row.qmsRecord)}</strong></Link>{!row.qmsRecord.isActive ? <span className="badge neutral">Anulado</span> : null}</td>
                    <td data-column-key="department">{row.departmentCodeSnapshot ?? "—"}</td>
                    <td data-column-key="origin">{originRecords.length ? originRecords.map((record) => qmsRecordTypeLabel(record.recordType)).join(" · ") : row.originType ?? "—"}</td>
                    <td data-column-key="originCode">{originRecords.length ? originRecords.map((record) => qmsRecordDisplayCode(record, qmsRecordTypeLabel(record.recordType))).join(" · ") : row.originCode ?? "—"}</td>
                    <td data-column-key="description" className="long-cell">{actionDescription}</td>
                    <td data-column-key="opening">{formatDate(row.openedAt)}</td>
                    <td data-column-key="planned">{formatDate(plannedDate)}</td>
                    <td data-column-key="status"><span className={`status-badge ${row.status.toLowerCase()}`}>{capaStatusLabel(row.status)}</span></td>
                    <td data-column-key="operationalClose">{formatDate(row.operationalClosedAt)}</td>
                    <td data-column-key="effectiveness"><span className={`badge ${row.effectivenessStatus === "CONFORMING" ? "closed" : row.effectivenessStatus === "NONCONFORMING" ? "major" : "warning"}`}>{effectivenessLabel(row.effectivenessStatus)}</span></td>
                    <td data-column-key="latestFollowup">{currentVersion ? `Seguimiento ${String(currentVersion.sequenceNumber).padStart(2,"0")}` : "Seguimiento 00"}</td>
                    <td data-column-key="nextFollowup">{formatDate(row.nextFollowupDate)}</td>
                    <td data-column-key="effectiveClose">{formatDate(row.effectiveClosedAt)}</td>
                    <td data-column-key="related">
                      <div className="relation-chips">
                        {[...row.qmsRecord.sourceRelations.map((x)=>x.targetRecord), ...row.qmsRecord.targetRelations.map((x)=>x.sourceRecord)].map((record)=>(
                          <Link key={record.id} className="relation-chip" href={qmsRecordHref(record.recordType, record.id)} title={qmsRecordTypeLabel(record.recordType)}>
                            {qmsRecordDisplayCode(record, qmsRecordTypeLabel(record.recordType))}{!record.isActive ? " · Anulado" : ""}
                          </Link>
                        ))}
                        {row.qmsRecord.sourceRelations.length + row.qmsRecord.targetRelations.length === 0 ? "—" : null}
                      </div>
                    </td>
                    <td data-column-key="observations" className="long-cell">{row.internalObservations ?? "—"}</td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan={19}><div className="empty-panel">No hay CAPA que coincidan con los filtros.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
