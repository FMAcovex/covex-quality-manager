import Link from "next/link";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { PermissionGate } from "@/components/permissions";
import { SavedViews } from "@/components/saved-views";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { authorizedPage } from "@/lib/auth/page-guard";
import { appendFilterValues, firstQueryValue, queryList } from "@/lib/qms/list-filters";
import { qmsListingUrl, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { listSavedViews } from "@/lib/saved-views/queries";
import { formatOosDate, oosInvestigationResultLabels, oosPhase, oosStatusLabels } from "@/modules/oos/domain";
import { getOosList } from "@/modules/oos/queries";

export const dynamic = "force-dynamic";

async function OosListPageAuthenticatedContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const filters = {
    page: firstQueryValue(query.page),
    q: firstQueryValue(query.q),
    administrative: firstQueryValue(query.administrative),
    phase: firstQueryValue(query.phase),
    year: queryList(query.year),
    area: queryList(query.area),
    status: queryList(query.status),
    result: queryList(query.result),
  };
  const [{ rows, years, counters, page, pageSize, count }, savedViews] = await Promise.all([getOosList(filters), listSavedViews("/oos")]);
  const toDetail = (id: string) => qmsWithReturnTo(`/oos/${id}`, "/oos", qmsListingUrl("/oos", query));
  const pageParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => appendFilterValues(pageParams, key, value));
  pageParams.delete("page");
  const pageHref = (next: number) => {
    const params = new URLSearchParams(pageParams);
    params.set("page", String(next));
    return `/oos?${params}`;
  };

  return <section className="workspace qms-list-ux-b">
    <div className="page-heading">
      <div><p className="eyebrow">Sistema de Calidad</p><h1>OOS</h1><p>Resultados fuera de especificación · GC-10/014/04.</p></div>
      <div className="heading-actions"><PermissionGate permission="CREATE" module="OOS"><Link href="/oos/new" className="button primary">+ Nuevo OOS</Link></PermissionGate></div>
    </div>
    <form method="get" className="toolbar-form">
      <div className="filter-panel operational">
        <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative ?? ""}><option value="">Activos</option><option value="ANNULLED">Anulados</option><option value="ALL">Todos</option></select></label>
        <MultiSelectFilter name="year" label="Año" selected={filters.year} options={years.map((year) => ({ value: String(year), label: String(year) }))} />
        <MultiSelectFilter name="area" label="Área" selected={filters.area} options={[{ value: "API", label: "API" }, { value: "MD", label: "MD" }]} />
        <MultiSelectFilter name="status" label="Estado" selected={filters.status} options={[{ value: "DRAFT", label: "Borrador" }, { value: "OPEN", label: "Abierto" }, { value: "CLOSED", label: "Cerrado" }]} />
        <label className="filter-placeholder"><span>Fase</span><select name="phase" defaultValue={filters.phase ?? ""}><option value="">Todas</option><option value="I">Fase I</option><option value="II">Fase II</option></select></label>
        <MultiSelectFilter name="result" label="Resultado" selected={filters.result} options={Object.entries(oosInvestigationResultLabels).map(([value, label]) => ({ value, label }))} />
        <div className="filter-actions"><button className="button small">Aplicar</button><Link className="button small" href="/oos">Limpiar</Link><SavedViews listPath="/oos" views={savedViews} /></div>
      </div>
      <div className="search-row">
        <SearchAutocomplete
          defaultValue={filters.q ?? ""}
          placeholder="Buscar código, material, lote, proveedor o descripción…"
          suggestions={rows.map((row) => ({
            id: row.id,
            href: toDetail(row.id),
            code: qmsRecordDisplayCode(row.qmsRecord),
            title: row.materialName ?? "Sin material",
            meta: [row.lotNumber, oosStatusLabels[row.status]].filter(Boolean).join(" · "),
            searchText: [row.qmsRecord.businessCode, row.materialName, row.lotNumber, row.supplier, row.detectionDescription].filter(Boolean).join(" "),
          }))}
        />
        <button className="button" type="submit">Buscar</button>
      </div>
    </form>
    <div className="status-strip">
      <div><strong>{counters.operational}</strong><span>Operativos</span></div>
      <div><strong>{counters.drafts}</strong><span>Borradores</span></div>
      <div><strong>{counters.phaseI}</strong><span>Abiertos en Fase I</span></div>
      <div><strong>{counters.phaseII}</strong><span>Abiertos en Fase II</span></div>
      <div><strong>{counters.closed}</strong><span>Cerrados</span></div>
    </div>
    <div className="table-card"><div className="table-scroll"><table className="change-table">
      <thead><tr><th>N.º OOS</th><th>Estado</th><th>Fase</th><th>Fecha de apertura</th><th>Material afectado</th><th>Lote</th><th>Descripción</th><th>Resultado</th><th>CAPA / Desviación</th><th>Fecha de cierre</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.id}>
        <td><Link className="summary-link" href={toDetail(row.id)}>{qmsRecordDisplayCode(row.qmsRecord)}</Link>{!row.qmsRecord.isActive ? <span className="badge neutral">Anulado</span> : null}</td>
        <td><span className={`badge ${row.status === "DRAFT" ? "neutral" : row.status === "OPEN" ? "open" : "closed"}`}>{oosStatusLabels[row.status]}</span></td>
        <td>{row.status === "DRAFT" ? "—" : `Fase ${oosPhase(row.phaseIDisposition)}`}</td>
        <td>{formatOosDate(row.issueDate)}</td>
        <td className="table-cell-wrap">{row.materialName ?? "—"}</td>
        <td>{row.lotNumber ?? "—"}</td>
        <td className="table-cell-wrap">{row.detectionDescription ?? "—"}</td>
        <td>{row.investigationResult ? oosInvestigationResultLabels[row.investigationResult] : "—"}</td>
        <td><div className="relation-chips">{row.qmsRecord.sourceRelations.map(({ targetRecord: related }) => <Link key={related.id} className="relation-chip" href={qmsRecordHref(related.recordType, related.id)} title={qmsRecordTypeLabel(related.recordType)}>{qmsRecordDisplayCode(related, qmsRecordTypeLabel(related.recordType))}{!related.isActive ? " · Anulado" : ""}</Link>)}{row.qmsRecord.sourceRelations.length ? null : "—"}</div></td>
        <td>{formatOosDate(row.closedAt)}</td>
      </tr>) : <tr><td colSpan={10} className="empty-state"><strong>No hay OOS con estos filtros.</strong></td></tr>}</tbody>
    </table></div></div>
    <nav className="form-footer" aria-label="Paginación de OOS"><span>{count} resultados · página {page} de {Math.max(1, Math.ceil(count / pageSize))}</span>{page > 1 ? <Link className="button small" href={pageHref(page - 1)}>Anterior</Link> : null}{page * pageSize < count ? <Link className="button small" href={pageHref(page + 1)}>Siguiente</Link> : null}</nav>
  </section>;
}

export default async function OosListPage(...args: Parameters<typeof OosListPageAuthenticatedContent>) {
  return authorizedPage("src/app/oos/page.tsx", () => OosListPageAuthenticatedContent(...args), args);
}
