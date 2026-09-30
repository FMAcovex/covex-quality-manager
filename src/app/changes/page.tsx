import Link from "next/link";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { isActiveTemplateAssetReady } from "@/modules/configuration/template-readiness";
import { ColumnSelector } from "@/components/column-selector";
import { changeControlColumns } from "@/modules/change-control/column-config";
import {
  classificationLabel,
  effectivenessStatusLabel,
  executionStatusLabel,
  finalStatusLabel,
  formatDate,
} from "@/modules/change-control/domain";
import { getChangeControlList } from "@/modules/change-control/queries";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { ManualReminderToolbar } from "@/components/manual-reminder-toolbar";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { appendFilterValues, firstQueryValue, queryList } from "@/lib/qms/list-filters";

export const dynamic = "force-dynamic";

const param = firstQueryValue;

export default async function ChangeControlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = {
    q: param(query.q),
    administrative: param(query.administrative),
    year: queryList(query.year),
    department: queryList(query.department),
    classification: queryList(query.classification),
    execution: queryList(query.execution),
    effectiveness: queryList(query.effectiveness),
    status: queryList(query.status),
  };
  const { rows, departments, years, counters } = await getChangeControlList(filters);
  const officialTemplateReady = await isActiveTemplateAssetReady(QmsRecordType.CHANGE_CONTROL, DocumentType.CHANGE_ANNEX_VII);
  const exportYear = filters.year[0] ?? String(new Date().getFullYear());
  const simpleParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => appendFilterValues(simpleParams, key, value));

  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sistema de Calidad</p>
          <h1>Controles de Cambios</h1>
          <p>Solicitud, Dictamen, ejecución, seguimientos, eficacia y cierre.</p>
        </div>
        <div className="heading-actions">
          <Link href="/changes/new" className="button primary">+ Nuevo Control de Cambio</Link>
          <ColumnSelector
            tableId="change-control-list-table"
            storageKey="qms.columns.change-control"
            columns={[...changeControlColumns]}
          />
          <details className="export-menu">
            <summary className="button">Exportar ▾</summary>
            <div className="export-popover">
              <strong>Exportaciones de Controles de Cambios</strong>
              {officialTemplateReady ? <a href={`/api/changes/export/annex-vii?year=${exportYear}`}>Anexo VII oficial · {exportYear}</a> : <span className="template-missing-note">Anexo VII bloqueado · plantilla oficial pendiente de cargar.</span>}
              <a href={`/api/changes/export/simple?${simpleParams.toString()}`}>
                Listado simple · filtros actuales
              </a>
              <span className="muted-note">
                El Anexo VII conserva solo las columnas oficiales. El listado simple incluye el seguimiento operativo ampliado.
              </span>
            </div>
          </details>
        </div>
      </div>

      <div className="tabs">
        <Link className="tab active" href="/changes">Expedientes</Link>
        <Link className="tab muted" href="/changes/indicators">Indicadores</Link>
      </div>

      <form method="get" className="toolbar-form">
        <div className="filter-panel operational change-filters">
          <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative ?? ""}><option value="">Activos</option><option value="ANNULLED">Anulados</option><option value="ALL">Todos</option></select></label>
          <MultiSelectFilter name="year" label="Año" selected={filters.year} options={years.map((year)=>({value:String(year),label:String(year)}))} />
          <MultiSelectFilter name="department" label="Departamento" selected={filters.department} options={departments.map((d)=>({value:d.id,label:d.code}))} />
          <MultiSelectFilter name="classification" label="Clasificación" selected={filters.classification} options={[{value:"MAJOR",label:"Mayor"},{value:"MINOR",label:"Menor"}]} />
          <MultiSelectFilter name="execution" label="Ejecución" selected={filters.execution} options={[{value:"NOT_EXECUTED",label:"No ejecutado"},{value:"EXECUTED",label:"Ejecutado"}]} />
          <MultiSelectFilter name="effectiveness" label="Eficacia" selected={filters.effectiveness} options={[{value:"PENDING",label:"Pendiente"},{value:"ACCEPTABLE",label:"Aceptable"},{value:"NOT_ACCEPTABLE",label:"No aceptable"},{value:"NOT_APPLICABLE",label:"No aplica"}]} />
          <MultiSelectFilter name="status" label="Estado final" selected={filters.status} options={[{value:"DRAFT",label:"Borrador"},{value:"OPEN",label:"Abierto"},{value:"CLOSED",label:"Cerrado"}]} />
          <div className="filter-actions"><button className="button small" type="submit">Aplicar</button><Link className="button small" href="/changes">Limpiar</Link></div>
        </div>
        <div className="search-row">
          <SearchAutocomplete
            defaultValue={filters.q ?? ""}
            placeholder="Buscar código, descripción, solicitante, tarea u observaciones…"
            suggestions={rows.map((row) => ({
              id: row.id,
              href: `/changes/${row.id}`,
              code: row.qmsRecord.businessCode ?? "Sin código",
              title: row.description ?? "Sin descripción",
              meta: [row.departmentCodeSnapshot, finalStatusLabel(row.finalStatus)].filter(Boolean).join(" · "),
              searchText: [
                row.qmsRecord.businessCode,
                row.description,
                row.justification,
                row.requesterName,
                row.internalObservations,
                ...row.tasks.map((task) => task.description),
              ].filter(Boolean).join(" "),
            }))}
          />
          <button className="button" type="submit">Buscar</button>
        </div>
      </form>

      <div className="summary-strip">
        <div><span>Total operativos</span><strong>{counters.total}</strong></div>
        <div><span>Borradores</span><strong>{counters.drafts}</strong></div>
        <div><span>Abiertos</span><strong>{counters.open}</strong></div>
        <div><span>Ejecutados · eficacia pendiente</span><strong>{counters.executedPendingEfficacy}</strong></div>
        <div><span>Seguimiento vencido</span><strong>{counters.overdue}</strong></div>
      </div>

      <ManualReminderToolbar tableId="change-control-list-table" moduleLabel="Controles de Cambios" />

      <div className="table-card">
        <div className="table-scroll">
          <table id="change-control-list-table" className="records-table change-table">
            <thead>
              <tr>
                <th className="reminder-select-column" aria-label="Seleccionar"><input type="checkbox" data-reminder-select-all="true" aria-label="Seleccionar todos los Controles de Cambios visibles" /></th>
                <th data-column-key="control">Control</th>
                <th data-column-key="department">Departamento</th>
                <th data-column-key="code">Codificación</th>
                <th data-column-key="description">Descripción</th>
                <th data-column-key="requestDate">Fecha solicitud</th>
                <th data-column-key="approvalDate">Fecha aprobación</th>
                <th data-column-key="classification">Clasificación</th>
                <th data-column-key="plannedDate">Fecha prevista ejecución</th>
                <th data-column-key="execution">Estado ejecución</th>
                <th data-column-key="executionDate">Fecha ejecución</th>
                <th data-column-key="effectiveness">Eficacia</th>
                <th data-column-key="latestFollowup">Último seguimiento</th>
                <th data-column-key="nextFollowup">Próximo seguimiento</th>
                <th data-column-key="finalStatus">Estado final</th>
                <th data-column-key="closureDate">Fecha cierre</th>
                <th data-column-key="related">Relacionados</th>
                <th data-column-key="observations">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const latest = row.followups[0];
                const taskDates = row.tasks.map((item) => item.plannedDate).filter((value): value is Date => Boolean(value));
                const planned = row.plannedImplementationDate ?? (taskDates.length ? new Date(Math.max(...taskDates.map((d) => d.getTime()))) : null);
                return (
                  <tr key={row.id}>
                    <td className="reminder-select-column">
                      <input
                        type="checkbox"
                        data-reminder-record="true"
                        data-reminder-id={row.qmsRecord.id}
                        data-reminder-code={qmsRecordDisplayCode(row.qmsRecord)}
                        data-reminder-summary={row.description ?? "Sin descripción"}
                        data-reminder-status={finalStatusLabel(row.finalStatus)}
                        data-reminder-meta={row.departmentCodeSnapshot ?? ""}
                        data-reminder-href={`/changes/${row.id}`}
                        aria-label={`Seleccionar ${row.qmsRecord.businessCode ?? "Control de Cambio"}`}
                      />
                    </td>
                    <td data-column-key="control">{row.dataQualityStatus !== "COMPLETE" ? <span className="control-flag">⚠ Revisar</span> : "—"}</td>
                    <td data-column-key="department">{row.departmentCodeSnapshot ?? "—"}</td>
                    <td data-column-key="code" className="sticky-code"><Link href={`/changes/${row.id}`}><strong>{qmsRecordDisplayCode(row.qmsRecord)}</strong></Link>{!row.qmsRecord.isActive ? <span className="badge neutral">Anulado</span> : null}</td>
                    <td data-column-key="description" className="long-cell">{row.description ?? "—"}</td>
                    <td data-column-key="requestDate">{formatDate(row.requestDate)}</td>
                    <td data-column-key="approvalDate">{formatDate(row.dictamenDate)}</td>
                    <td data-column-key="classification"><span className="badge neutral">{classificationLabel(row.classification)}</span></td>
                    <td data-column-key="plannedDate">{formatDate(planned)}</td>
                    <td data-column-key="execution"><span className={`badge ${row.executionStatus === "EXECUTED" ? "closed" : "warning"}`}>{executionStatusLabel(row.executionStatus)}</span></td>
                    <td data-column-key="executionDate">{formatDate(row.executionDate)}</td>
                    <td data-column-key="effectiveness"><span className={`badge ${row.effectivenessStatus === "ACCEPTABLE" ? "closed" : row.effectivenessStatus === "NOT_ACCEPTABLE" ? "major" : row.effectivenessStatus === "NOT_APPLICABLE" ? "neutral" : "warning"}`}>{effectivenessStatusLabel(row.effectivenessStatus)}</span></td>
                    <td data-column-key="latestFollowup">{latest ? `${String(latest.sequenceNumber).padStart(2,"0")} · ${formatDate(latest.followupDate)}` : "—"}</td>
                    <td data-column-key="nextFollowup">{formatDate(latest?.nextFollowupDate)}</td>
                    <td data-column-key="finalStatus"><span className={`status-badge ${row.finalStatus.toLowerCase()}`}>{finalStatusLabel(row.finalStatus)}</span></td>
                    <td data-column-key="closureDate">{formatDate(row.effectiveClosedAt)}</td>
                    <td data-column-key="related"><div className="relation-chips">
                      {[...row.qmsRecord.sourceRelations.map(x=>x.targetRecord),...row.qmsRecord.targetRelations.map(x=>x.sourceRecord)].map(record=><Link key={record.id} className="relation-chip" href={qmsRecordHref(record.recordType,record.id)} title={qmsRecordTypeLabel(record.recordType)}>{qmsRecordDisplayCode(record,qmsRecordTypeLabel(record.recordType))}{!record.isActive?" · Anulado":""}</Link>)}
                      {row.qmsRecord.sourceRelations.length+row.qmsRecord.targetRelations.length===0?"—":null}
                    </div></td>
                    <td data-column-key="observations" className="long-cell">{row.internalObservations ?? "—"}</td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan={18}><div className="empty-panel">No hay Controles de Cambios que coincidan con los filtros.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
