import Link from "next/link";
import { deadlineLabel, formatDate, measuresLabel } from "@/modules/deviations/domain";
import { getDeviationList } from "@/modules/deviations/queries";

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DeviationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = {
    q: param(query.q),
    year: param(query.year),
    department: param(query.department),
    status: param(query.status),
    classification: param(query.classification),
    provenance: param(query.provenance),
    measures: param(query.measures),
    capa: param(query.capa),
    deadline: param(query.deadline),
  };

  const { rows, departments, years, provenances, counters } = await getDeviationList(filters);
  const exportParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) exportParams.set(key, value);
  });
  const currentYear = filters.year ?? String(new Date().getFullYear());

  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sistema de Calidad</p>
          <h1>Desviaciones</h1>
          <p>Registro, seguimiento e investigación de expedientes.</p>
        </div>
        <div className="heading-actions">
          <Link href="/deviations/new" className="button primary">+ Nueva desviación</Link>
          <details className="export-menu">
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
                <button className="button small" type="submit">Descargar</button>
              </form>
              <a className="export-link" href={`/api/deviations/export/simple?${exportParams.toString()}`}>
                Listado simple · filtros actuales
              </a>
              <a className="export-link" href={`/api/deviations/export/simple?year=${encodeURIComponent(currentYear)}`}>
                Listado simple · año {currentYear}
              </a>
            </div>
          </details>
        </div>
      </div>

      <div className="tabs">
        <Link className="tab active" href="/deviations">Expedientes</Link>
        <Link className="tab muted" href="/deviations/indicators">Indicadores</Link>
      </div>

      <form method="get" className="toolbar-form">
        <div className="filter-panel operational">
          <label className="filter-placeholder"><span>Año</span><select name="year" defaultValue={filters.year ?? ""}><option value="">Todos</option>{years.map((year)=><option key={year} value={year}>{year}</option>)}</select></label>
          <label className="filter-placeholder"><span>Departamento</span><select name="department" defaultValue={filters.department ?? ""}><option value="">Todos</option>{departments.map((d)=><option key={d.id} value={d.id}>{d.code}</option>)}</select></label>
          <label className="filter-placeholder"><span>Estado</span><select name="status" defaultValue={filters.status ?? ""}><option value="">Todos</option><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option></select></label>
          <label className="filter-placeholder"><span>Clasificación</span><select name="classification" defaultValue={filters.classification ?? ""}><option value="">Todas</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option></select></label>
          <label className="filter-placeholder"><span>Procedencia</span><select name="provenance" defaultValue={filters.provenance ?? ""}><option value="">Todas</option>{provenances.map((value)=><option key={value} value={value}>{value}</option>)}</select></label>
          <label className="filter-placeholder"><span>Medidas</span><select name="measures" defaultValue={filters.measures ?? ""}><option value="">Todas</option><option value="none">Ninguna</option><option value="immediate">Correctiva inmediata</option><option value="capa">CAPA</option><option value="both">Inmediata + CAPA</option></select></label>
          <label className="filter-placeholder"><span>CAPA</span><select name="capa" defaultValue={filters.capa ?? ""}><option value="">Todas</option><option value="yes">Con CAPA</option><option value="no">Sin CAPA</option></select></label>
          <label className="filter-placeholder"><span>En plazo</span><select name="deadline" defaultValue={filters.deadline ?? ""}><option value="">Todos</option><option value="IN_TIME">Sí</option><option value="OUT_OF_TIME">No</option><option value="NOT_EVALUATED">No evaluado</option><option value="NA">N/A</option></select></label>
          <div className="filter-actions"><button className="button small" type="submit">Aplicar</button><Link className="button small" href="/deviations">Limpiar</Link></div>
        </div>
        <div className="search-row">
          <input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar por código, descripción, material/proceso, causa raíz, CAPA u observaciones…" />
          <button className="button" type="submit">Buscar</button>
        </div>
      </form>

      <div className="status-strip">
        <div><strong>{counters.total}</strong><span>Desviaciones</span></div>
        <div><strong>{counters.open}</strong><span>Abiertas</span></div>
        <div><strong>{counters.overdue}</strong><span>Fuera de plazo</span></div>
        <div><strong>{counters.followupDue}</strong><span>Seguimientos vencidos</span></div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr>
              <th>Control</th><th>Código</th><th>Departamento</th><th>Material / Proceso</th><th>Procedencia</th><th>Descripción</th><th>Clasificación</th><th>Causa raíz</th><th>Apertura</th><th>Cierre</th><th>Estado</th><th>En plazo</th><th>Medidas adoptadas</th><th>Descripción CAPA</th><th>Documento</th><th>Observaciones</th>
            </tr></thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.dataQualityStatus !== "COMPLETE" ? <span className="control-flag">⚠ {row.dataQualityStatus === "INCOMPLETE" ? "Incompleto" : "Revisar"}</span> : "—"}</td>
                  <td><Link className="summary-link" href={`/deviations/${row.id}`}>{row.qmsRecord.businessCode ?? "Sin código"}</Link></td>
                  <td>{row.departmentCodeSnapshot ?? row.department?.code ?? "—"}</td>
                  <td className="table-cell-medium">{row.materialProcessAffected ?? "—"}</td>
                  <td>{row.provenance ?? "—"}</td>
                  <td className="table-cell-wrap">{row.whatHappened ?? "—"}</td>
                  <td>{row.classification ? <span className={`badge ${row.classification.toLowerCase()}`}>{row.classification === "CRITICAL" ? "Crítica" : row.classification === "MAJOR" ? "Mayor" : "Menor"}</span> : "—"}</td>
                  <td className="table-cell-wrap">{row.rootCause ?? "—"}</td>
                  <td>{formatDate(row.issueDate)}</td>
                  <td>{formatDate(row.closedAt)}</td>
                  <td><span className={`badge ${row.status === "OPEN" ? "open" : "closed"}`}>{row.status === "OPEN" ? "Abierta" : "Cerrada"}</span></td>
                  <td>{deadlineLabel(row.deadlineStatus)}</td>
                  <td>{measuresLabel(row)}</td>
                  <td className="table-cell-wrap">{row.capaPlans.length ? row.capaPlans.map((plan)=>plan.description).join(" · ") : "—"}</td>
                  <td>{row.signedDocumentAvailable === true ? "Disponible" : row.signedDocumentAvailable === false ? "No disponible" : "No informado"}</td>
                  <td className="table-cell-wrap">{row.internalObservations ?? "—"}</td>
                </tr>
              )) : <tr><td colSpan={16} className="empty-state"><strong>No hay desviaciones con estos filtros.</strong><span>Puedes crear una nueva desviación o limpiar los filtros.</span></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
