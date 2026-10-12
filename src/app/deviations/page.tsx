import { canPresentRecord } from "@/lib/auth/presentation";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { ReviewListFilter, ReviewListIndicator } from "@/components/review/review-list-controls";
import Link from "next/link";
import { QmsListPagination } from "@/components/qms-list-pagination";
import { qmsListingUrl, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { isActiveTemplateAssetReady } from "@/modules/configuration/template-readiness";
import { deadlineLabel, deviationProvenanceLabel, formatDate, measuresLabel } from "@/modules/deviations/domain";
import { getDeviationList } from "@/modules/deviations/queries";
import { ColumnSelector } from "@/components/column-selector";
import { deviationColumns } from "@/modules/deviations/column-config";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { ManualReminderToolbar } from "@/components/manual-reminder-toolbar";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { appendFilterValues, firstQueryValue, queryList } from "@/lib/qms/list-filters";

export const dynamic = "force-dynamic";

const param = firstQueryValue;

async function DeviationsPageAuthenticatedContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const toDetail = (id: string) => qmsWithReturnTo("/deviations/" + id, "/deviations", qmsListingUrl("/deviations", query));
  const filters = {
    page: param(query.page),
    review: firstQueryValue(query.review),
    q: param(query.q),
    administrative: param(query.administrative),
    year: queryList(query.year),
    department: queryList(query.department),
    status: queryList(query.status),
    classification: queryList(query.classification),
    provenance: queryList(query.provenance),
    measures: param(query.measures),
    capa: param(query.capa),
    deadline: param(query.deadline),
  };

  const { rows, departments, years, provenances, counters, pagination } = await getDeviationList(filters);
  const exportParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (key !== "page") appendFilterValues(exportParams, key, value); });
  const currentYear = filters.year[0] ?? String(new Date().getFullYear());
  const officialTemplateReady = await isActiveTemplateAssetReady(QmsRecordType.DEVIATION, DocumentType.DEVIATION_ANNEX_V);

  return (
    <section className="workspace qms-list-ux-b">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sistema de Calidad</p>
          <h1>Desviaciones</h1>
          <p>Registro, seguimiento e investigación de expedientes.</p>
        </div>
        <div className="heading-actions">
          <PermissionGate permission="CREATE" module="DEVIATION"><Link href="/deviations/new" className="button primary">+ Nueva desviación</Link></PermissionGate>
          <ColumnSelector tableId="deviation-list-table" storageKey="qms.columns.deviations" columns={[...deviationColumns]} />
          <PermissionGate permission="EXPORT"><details className="export-menu">
            <summary className="button">Exportar ▾</summary>
            <div className="export-popover">
              <strong>Exportaciones</strong>
              <form action="/api/deviations/export/annex-v" method="get" className="export-year-form">
                <label>
                  <span>Anexo V oficial</span>
                  <select name="year" defaultValue={currentYear}>
                    {Array.from(new Set([Number(currentYear), ...years]))
                      .filter((year) => Number.isInteger(year))
                      .sort((a, b) => b - a)
                      .map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
                {officialTemplateReady ? <button className="button small" type="submit">Descargar</button> : <><button className="button small" type="button" disabled>Descargar</button><span className="template-missing-note">Plantilla oficial pendiente de cargar.</span></>}
              </form>
              <PermissionGate permission="EXPORT"><a className="export-link" href={`/api/deviations/export/simple?${exportParams.toString()}`}>
                Listado simple · filtros actuales
              </a></PermissionGate>
              <PermissionGate permission="EXPORT"><a className="export-link" href={`/api/deviations/export/simple?year=${encodeURIComponent(currentYear)}`}>
                Listado simple · año {currentYear}
              </a></PermissionGate>
            </div>
          </details></PermissionGate>
        </div>
      </div>

      <div className="tabs">
        <Link className="tab active" href="/deviations">Expedientes</Link>
        <Link className="tab muted" href="/deviations/indicators">Indicadores</Link>
      </div>

      <form method="get" className="toolbar-form">
        <div className="filter-panel operational">
          <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative ?? ""}><option value="">Activos</option><option value="ANNULLED">Anulados</option><option value="ALL">Todos</option></select></label>
          <MultiSelectFilter name="year" label="Año" selected={filters.year} options={years.map((year)=>({value:String(year),label:String(year)}))} />
          <MultiSelectFilter name="department" label="Departamento" selected={filters.department} options={departments.map((d)=>({value:d.id,label:d.code}))} />
          <MultiSelectFilter name="status" label="Estado" selected={filters.status} options={[{value:"DRAFT",label:"Borrador"},{value:"OPEN",label:"Abierta"},{value:"CLOSED",label:"Cerrada"}]} />
          <MultiSelectFilter name="classification" label="Clasificación" selected={filters.classification} options={[{value:"CRITICAL",label:"Crítica"},{value:"MAJOR",label:"Mayor"},{value:"MINOR",label:"Menor"}]} />
          <MultiSelectFilter name="provenance" label="Procedencia" selected={filters.provenance} options={provenances.map((value)=>({value,label:deviationProvenanceLabel(value)}))} />
          <label className="filter-placeholder"><span>Medidas</span><select name="measures" defaultValue={filters.measures ?? ""}><option value="">Todas</option><option value="none">Ninguna</option><option value="immediate">Correctiva inmediata</option><option value="capa">CAPA</option><option value="both">Inmediata + CAPA</option></select></label>
          <label className="filter-placeholder"><span>CAPA</span><select name="capa" defaultValue={filters.capa ?? ""}><option value="">Todas</option><option value="yes">Con CAPA</option><option value="no">Sin CAPA</option></select></label>
          <label className="filter-placeholder"><span>En plazo</span><select name="deadline" defaultValue={filters.deadline ?? ""}><option value="">Todos</option><option value="IN_TIME">Sí</option><option value="OUT_OF_TIME">No</option><option value="NOT_EVALUATED">No evaluado</option><option value="NA">N/A</option></select></label>
          <ReviewListFilter value={filters.review} /><div className="filter-actions"><button className="button small" type="submit">Aplicar</button><Link className="button small" href="/deviations">Limpiar</Link></div>
        </div>
        <div className="search-row">
          <SearchAutocomplete
            defaultValue={filters.q ?? ""}
            placeholder="Buscar por código, descripción, material/proceso, causa raíz, CAPA u observaciones…"
            suggestions={rows.map((row) => ({
              id: row.id,
              href: toDetail(row.id),
              code: row.qmsRecord.businessCode ?? "Sin código",
              title: row.whatHappened ?? row.materialProcessAffected ?? "Sin descripción",
              meta: [row.departmentCodeSnapshot ?? row.department?.code, row.status === "DRAFT" ? "Borrador" : row.status === "OPEN" ? "Abierta" : "Cerrada"].filter(Boolean).join(" · "),
              searchText: [
                row.qmsRecord.businessCode,
                row.materialProcessAffected,
                row.provenance,
                deviationProvenanceLabel(row.provenance),
                row.whatHappened,
                row.rootCause,
                row.internalObservations,
                ...row.capaPlans.map((plan) => plan.description),
              ].filter(Boolean).join(" "),
            }))}
          />
          <button className="button" type="submit">Buscar</button>
        </div>
      </form>

      <div className="status-strip">
        <div><strong>{counters.total}</strong><span>Desviaciones</span></div>
        <div><strong>{counters.drafts}</strong><span>Borradores</span></div>
        <div><strong>{counters.open}</strong><span>Abiertas</span></div>
        <div><strong>{counters.overdue}</strong><span>Fuera de plazo</span></div>
        <div><strong>{counters.followupDue}</strong><span>Seguimientos vencidos</span></div>
      </div>

      <PermissionGate permission="FOLLOWUP"><ManualReminderToolbar tableId="deviation-list-table" moduleLabel="Desviaciones" /></PermissionGate>

      <div className="table-card">
        <div className="table-scroll">
          <table id="deviation-list-table">
            <thead><tr>
<th className="reminder-select-column" aria-label="Seleccionar"><PermissionGate permission="FOLLOWUP"><input type="checkbox" data-reminder-select-all="true" aria-label="Seleccionar todas las desviaciones visibles" /></PermissionGate></th><th data-column-key="control">Control</th><th data-column-key="review">Revisión</th><th data-column-key="code">Código</th><th data-column-key="department">Departamento</th><th data-column-key="material">Material / Proceso</th><th data-column-key="provenance">Procedencia</th><th data-column-key="description">Descripción</th><th data-column-key="classification">Clasificación</th><th data-column-key="rootCause">Causa raíz</th><th data-column-key="opening">Apertura</th><th data-column-key="closing">Cierre</th><th data-column-key="status">Estado</th><th data-column-key="deadline">En plazo</th><th data-column-key="measures">Medidas adoptadas</th><th data-column-key="capa">Descripción CAPA</th><th data-column-key="document">Documento</th><th data-column-key="related">Relacionados</th><th data-column-key="observations">Observaciones</th>
            </tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td className="reminder-select-column">
                    <PermissionGate permission="FOLLOWUP" allowed={canPresentRecord("DEVIATION", "FOLLOWUP", { id: row.qmsRecord.id, departmentIds: row.departmentId ? [row.departmentId] : [] })}><input
                      type="checkbox"
                      data-reminder-record="true"
                      data-reminder-id={row.qmsRecord.id}
                      data-reminder-code={qmsRecordDisplayCode(row.qmsRecord)}
                      data-reminder-summary={row.whatHappened ?? row.materialProcessAffected ?? "Sin descripción"}
                      data-reminder-status={row.status === "DRAFT" ? "Borrador" : row.status === "OPEN" ? "Abierta" : "Cerrada"}
                      data-reminder-meta={row.departmentCodeSnapshot ?? row.department?.code ?? ""}
                      data-reminder-href={toDetail(row.id)}
                      aria-label={`Seleccionar ${row.qmsRecord.businessCode ?? "desviación"}`}
                    /></PermissionGate>
                  </td>
                  <td data-column-key="control">{row.dataQualityStatus !== "COMPLETE" ? <span className="control-flag">⚠ {row.dataQualityStatus === "INCOMPLETE" ? "Incompleto" : "Revisar"}</span> : "—"}</td><td data-column-key="review"><ReviewListIndicator counts={row.reviewCounts} returnTo={qmsListingUrl("/deviations", query)} basePath={`/deviations/${row.id}`} /></td>
                  <td data-column-key="code"><Link className="summary-link" href={toDetail(row.id)}>{qmsRecordDisplayCode(row.qmsRecord)}</Link>{!row.qmsRecord.isActive ? <span className="badge neutral">Anulado</span> : null}</td>
                  <td data-column-key="department">{row.departmentCodeSnapshot ?? row.department?.code ?? "—"}</td>
                  <td data-column-key="material" className="table-cell-medium">{row.materialProcessAffected ?? "—"}</td>
                  <td data-column-key="provenance">{deviationProvenanceLabel(row.provenance)}</td>
                  <td data-column-key="description" className="table-cell-wrap">{row.whatHappened ?? "—"}</td>
                  <td data-column-key="classification">{row.classification ? <span className={`badge ${row.classification.toLowerCase()}`}>{row.classification === "CRITICAL" ? "Crítica" : row.classification === "MAJOR" ? "Mayor" : "Menor"}</span> : "—"}</td>
                  <td data-column-key="rootCause" className="table-cell-wrap">{row.rootCause ?? "—"}</td>
                  <td data-column-key="opening">{formatDate(row.issueDate)}</td>
                  <td data-column-key="closing">{formatDate(row.closedAt)}</td>
                  <td data-column-key="status"><span className={`badge ${row.status === "DRAFT" ? "neutral" : row.status === "OPEN" ? "open" : "closed"}`}>{row.status === "DRAFT" ? "Borrador" : row.status === "OPEN" ? "Abierta" : "Cerrada"}</span></td>
                  <td data-column-key="deadline">{deadlineLabel(row.deadlineStatus)}</td>
                  <td data-column-key="measures">{measuresLabel(row)}</td>
                  <td data-column-key="capa" className="table-cell-wrap">{row.capaPlans.length ? row.capaPlans.map((plan)=>plan.description).join(" · ") : "—"}</td>
                  <td data-column-key="document">{row.signedDocumentAvailable === true ? "Disponible" : row.signedDocumentAvailable === false ? "No disponible" : "No informado"}</td>
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
                  <td data-column-key="observations" className="table-cell-wrap">{row.internalObservations ?? "—"}</td>
                </tr>
              )) : <tr><td colSpan={19} className="empty-state"><strong>No hay desviaciones con estos filtros.</strong><span>Puedes crear una nueva desviación o limpiar los filtros.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <QmsListPagination root="/deviations" query={query} pagination={pagination} />
    </section>
  );
}

export default async function DeviationsPage(...args: Parameters<typeof DeviationsPageAuthenticatedContent>) {
  return authorizedPage("src/app/deviations/page.tsx", () => DeviationsPageAuthenticatedContent(...args), args);
}
