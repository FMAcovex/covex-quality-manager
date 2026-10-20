import Link from "next/link";
import { ListPagination } from "@/components/qms-list-pagination";
import { MultiSelectFilter } from "@/components/multi-select-filter";
import { PermissionGate } from "@/components/permissions";
import { SavedViews } from "@/components/saved-views";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { authorizedPage } from "@/lib/auth/page-guard";
import { activeFilterChips, appendFilterValues, firstQueryValue, queryList, type FilterDefinition } from "@/lib/qms/list-filters";
import { ListFilterToolbar } from "@/components/list-filter-toolbar";
import { qmsListingUrl, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { qmsRecordDisplayCode, qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { listSavedViews } from "@/lib/saved-views/queries";
import { formatOosDate, oosInvestigationResultLabels, oosPhase, oosStatusLabels } from "@/modules/oos/domain";
import { getOosList } from "@/modules/oos/queries";
import { isActiveTemplateAssetReady } from "@/modules/configuration/template-readiness";

export const dynamic = "force-dynamic";

const administrativeOptions = [{ value: "ANNULLED", label: "Anulados" }, { value: "ALL", label: "Todos" }];
const areaOptions = [{ value: "API", label: "API" }, { value: "MD", label: "MD" }];
const statusOptions = [{ value: "DRAFT", label: "Borrador" }, { value: "OPEN", label: "Abierto" }, { value: "CLOSED", label: "Cerrado" }];
const phaseOptions = [{ value: "I", label: "Fase I" }, { value: "II", label: "Fase II" }];
const resultOptions = Object.entries(oosInvestigationResultLabels).map(([value, label]) => ({ value, label }));
const option = (options: { value: string; label: string }[]) => options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>);

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
  const [{ rows, years, counters, page, pageSize, count }, savedViews, annexVIReady] = await Promise.all([getOosList(filters), listSavedViews("/oos"), isActiveTemplateAssetReady("OOS", "OOS_ANNEX_VI")]);
  // Anexo VI: un listado por año (§5.2 del PNT), del año en curso y de los años con OOS.
  const listingYears = [...new Set([new Date().getFullYear(), ...years])].sort((a, b) => b - a);
  const toDetail = (id: string) => qmsWithReturnTo(`/oos/${id}`, "/oos", qmsListingUrl("/oos", query));
  const yearOptions = years.map((year) => ({ value: String(year), label: String(year) }));
  const filterDefinitions: FilterDefinition[] = [
    { name: "administrative", label: "Estado administrativo", options: administrativeOptions },
    { name: "year", label: "Año", options: yearOptions },
    { name: "area", label: "Área", options: areaOptions },
    { name: "status", label: "Estado", options: statusOptions },
    { name: "phase", label: "Fase", options: phaseOptions },
    { name: "result", label: "Resultado", options: resultOptions },
  ];
  const pageParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => appendFilterValues(pageParams, key, value));
  pageParams.delete("page");
  const pageHref = (next: number) => {
    const params = new URLSearchParams(pageParams);
    params.set("page", String(next));
    return `/oos?${params}`;
  };

  return <section className="workspace qms-list-ux-b list-ux-c">
    <div className="page-heading">
      <div><p className="eyebrow">Sistema de Calidad</p><h1>OOS</h1><p>Resultados fuera de especificación · GC-10/014/04.</p></div>
      <div className="heading-actions">
        <PermissionGate permission="CREATE" module="OOS"><Link href="/oos/new" className="button primary">+ Nuevo OOS</Link></PermissionGate>
        <PermissionGate permission="EXPORT" module="OOS"><details className="export-menu"><summary className="button">Exportar ▾</summary><div className="export-popover"><strong>Anexo VI · Listado general de OOS</strong>{annexVIReady ? listingYears.map((year) => <a key={year} className="export-link" href={`/api/oos/export/annex-vi?year=${year}`}>Anexo VI oficial · año {year}</a>) : <span className="template-missing-note">Anexo VI bloqueado · plantilla oficial pendiente de cargar.</span>}</div></details></PermissionGate>
      </div>
    </div>
    <form method="get" className="toolbar-form">
      <ListFilterToolbar
        storageKey="qms.filters.oos"
        clearHref="/oos"
        chips={activeFilterChips("/oos", query, filterDefinitions)}
        views={<SavedViews listPath="/oos" views={savedViews} />}
        search={<SearchAutocomplete
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
        />}
      >
        <label className="filter-placeholder"><span>Estado administrativo</span><select name="administrative" defaultValue={filters.administrative ?? ""}><option value="">Activos</option>{option(administrativeOptions)}</select></label>
        <MultiSelectFilter name="year" label="Año" selected={filters.year} options={yearOptions} />
        <MultiSelectFilter name="area" label="Área" selected={filters.area} options={areaOptions} />
        <MultiSelectFilter name="status" label="Estado" selected={filters.status} options={statusOptions} />
        <label className="filter-placeholder"><span>Fase</span><select name="phase" defaultValue={filters.phase ?? ""}><option value="">Todas</option>{option(phaseOptions)}</select></label>
        <MultiSelectFilter name="result" label="Resultado" selected={filters.result} options={resultOptions} />
      </ListFilterToolbar>
    </form>
    <p className="list-counters">
      <span><strong>{counters.operational}</strong> operativos</span>
      <span><strong>{counters.drafts}</strong> borradores</span>
      <span><strong>{counters.phaseI}</strong> abiertos en Fase I</span>
      <span><strong>{counters.phaseII}</strong> abiertos en Fase II</span>
      <span><strong>{counters.closed}</strong> cerrados</span>
    <span className="list-counters-note">Totales del módulo sin filtros. No incluyen anulados; los borradores se cuentan aparte.</span></p>
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
    <ListPagination total={count} page={page} pageCount={Math.ceil(count / pageSize)} pageSize={pageSize} href={pageHref} />
  </section>;
}

export default async function OosListPage(...args: Parameters<typeof OosListPageAuthenticatedContent>) {
  return authorizedPage("src/app/oos/page.tsx", () => OosListPageAuthenticatedContent(...args), args);
}
