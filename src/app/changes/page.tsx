import Link from "next/link";
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

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChangeControlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = {
    q: param(query.q),
    year: param(query.year),
    department: param(query.department),
    classification: param(query.classification),
    execution: param(query.execution),
    effectiveness: param(query.effectiveness),
    status: param(query.status),
  };
  const { rows, departments, years, counters } = await getChangeControlList(filters);

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
              <span className="muted-note">Anexo VII y listado simple quedarán disponibles con las plantillas oficiales instaladas.</span>
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
          <label className="filter-placeholder"><span>Año</span><select name="year" defaultValue={filters.year ?? ""}><option value="">Todos</option>{years.map((year)=><option key={year} value={year}>{year}</option>)}</select></label>
          <label className="filter-placeholder"><span>Departamento</span><select name="department" defaultValue={filters.department ?? ""}><option value="">Todos</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.code}</option>)}</select></label>
          <label className="filter-placeholder"><span>Clasificación</span><select name="classification" defaultValue={filters.classification ?? ""}><option value="">Todas</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option></select></label>
          <label className="filter-placeholder"><span>Ejecución</span><select name="execution" defaultValue={filters.execution ?? ""}><option value="">Todas</option><option value="NOT_EXECUTED">No ejecutado</option><option value="EXECUTED">Ejecutado</option></select></label>
          <label className="filter-placeholder"><span>Eficacia</span><select name="effectiveness" defaultValue={filters.effectiveness ?? ""}><option value="">Todas</option><option value="PENDING">Pendiente</option><option value="ACCEPTABLE">Aceptable</option><option value="NOT_ACCEPTABLE">No aceptable</option><option value="NOT_APPLICABLE">No aplica</option></select></label>
          <label className="filter-placeholder"><span>Estado final</span><select name="status" defaultValue={filters.status ?? ""}><option value="">Todos</option><option value="OPEN">Abierto</option><option value="CLOSED">Cerrado</option></select></label>
          <div className="filter-actions"><button className="button small" type="submit">Aplicar</button><Link className="button small" href="/changes">Limpiar</Link></div>
        </div>
        <div className="search-row">
          <input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar código, descripción, solicitante, tarea u observaciones…" />
          <button className="button" type="submit">Buscar</button>
        </div>
      </form>

      <div className="summary-strip">
        <div><span>Total</span><strong>{counters.total}</strong></div>
        <div><span>Abiertos</span><strong>{counters.open}</strong></div>
        <div><span>Ejecutados · eficacia pendiente</span><strong>{counters.executedPendingEfficacy}</strong></div>
        <div><span>Seguimiento vencido</span><strong>{counters.overdue}</strong></div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table id="change-control-list-table" className="records-table change-table">
            <thead>
              <tr>
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
                    <td data-column-key="control">{row.dataQualityStatus !== "COMPLETE" ? <span className="control-flag">⚠ Revisar</span> : "—"}</td>
                    <td data-column-key="department">{row.departmentCodeSnapshot ?? "—"}</td>
                    <td data-column-key="code" className="sticky-code"><Link href={`/changes/${row.id}`}><strong>{row.qmsRecord.businessCode ?? "Sin código"}</strong></Link></td>
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
                    <td data-column-key="observations" className="long-cell">{row.internalObservations ?? "—"}</td>
                  </tr>
                );
              })}
              {!rows.length ? <tr><td colSpan={16}><div className="empty-panel">No hay Controles de Cambios que coincidan con los filtros.</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
