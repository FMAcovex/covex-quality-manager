import { SavedViews } from "@/components/saved-views";
import { listSavedViews } from "@/lib/saved-views/queries";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { prisma } from "@/lib/db";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { administrativeLabels, displayDate, revisionLabels } from "@/modules/controlled-documents/domain";
import { documentStateLabel } from "@/modules/controlled-documents/presentation";
import { DocumentStateBadge } from "@/modules/controlled-documents/components/document-state-badge";
import { listingQuery, withReturnTo } from "@/modules/controlled-documents/navigation";
import { importStates, indexMetadata } from "@/modules/controlled-documents/import/domain";
import { dateFilterErrors } from "@/modules/controlled-documents/queries";
import { queryPntListing, operationalDates, type PntListingFilters } from "@/modules/controlled-documents/listing";
export const dynamic = "force-dynamic";

async function ListPageAuthenticatedContent({ searchParams }: { searchParams: Promise<PntListingFilters> }) {
 const f = await searchParams;
 const savedViews = await listSavedViews("/controlled-documents");
 const [result, departments] = await Promise.all([queryPntListing(f), prisma.department.findMany({ orderBy: { code: "asc" } })]);
 const params = (changes: Record<string,string>, resetPage = true) => listingQuery(f, changes, resetPage);
 const returnTo = "/controlled-documents?" + params({}, false);
 const link = (changes: Record<string,string>) => "/controlled-documents?" + params(changes);
 const exportLink = "/api/controlled-documents/export?" + params({});
 const errors = dateFilterErrors(f);
 const advancedActive = Boolean(f.department || f.state || f.revision || f.revisionState || f.validity || f.effectiveFromStart || f.effectiveFromEnd || f.reviewDueStart || f.reviewDueEnd || result.options.view !== "all" || result.options.sort !== "code" || result.options.direction !== "asc");
 const headings: [string, string][] = [
   ["code","Código"], ["title","Título"], ["department","Departamento"], ["masterState","Estado maestro"],
   ["revision","Revisión"], ["status","Estado documental"], ["effectiveFrom","Fecha de vigencia"], ["reviewDueAt","Próxima revisión"],
 ];
 return <section className="workspace pnt-workspace pnt-p3c4 qms-list-ux-b">
  <header className="page-heading pnt-hero"><div><p className="eyebrow">GESTIÓN DOCUMENTAL · PNT</p><h1>Biblioteca de procedimientos</h1><p className="muted-note">Consulta de revisiones, estados, fechas y documentos controlados.</p></div><div className="heading-actions"><PermissionGate permission="CREATE" module="PNT"><Link className="button primary" href={withReturnTo("/controlled-documents/new", returnTo)}>Nuevo PNT</Link></PermissionGate><PermissionGate permission="IMPORT"><Link className="button" href="/controlled-documents/import-index">Importar índice maestro</Link></PermissionGate></div></header>
  <p className="pnt-summary list-counters" aria-label="Resumen del listado">
    <span><strong>{result.masterCount}</strong> procedimientos</span>
    <span><strong>{result.revisionCount}</strong> revisiones</span>
    <span><strong>{result.rowCount}</strong> filas encontradas</span>
  </p>
  <section className="pnt-filter-card"><div className="pnt-section-heading pnt-filter-heading"><div className="pnt-quick" aria-label="Filtros rápidos">{[
    ["","Todas"], ["current","Vigentes"], ["dueSoon","Revisión en 30 días"], ["overdue","Revisión vencida"], ["missing","Sin fechas"], ["unverified","Pendientes de verificar"],
   ].map(([value,label]) => <Link key={value} className={"pnt-quick-link"+(result.options.quick === (value || null) ? " is-active" : "")} href={link({quick:value})}>{label}</Link>)}</div><div className="pnt-heading-actions"><SavedViews listPath="/controlled-documents" views={savedViews} /><Link className="button" href="/controlled-documents">Limpiar filtros</Link></div></div>
   <form className="filter-panel pnt-filters" method="get">
    {f.quick && <input type="hidden" name="quick" value={f.quick}/>}
    <div className="pnt-search-row"><label className="field"><span>Buscar</span><input name="q" defaultValue={f.q} placeholder="Código, título o referencia"/></label><button className="button primary" type="submit">Buscar</button></div>
    <details className="pnt-advanced-filters" open={advancedActive}><summary>Filtros avanzados{advancedActive ? " · activos" : ""}<span className="pnt-advanced-hint">Departamento, estado, revisión, fechas y ordenación</span></summary>
    <div className="pnt-advanced-grid">
    <label className="field"><span>Departamento</span><select name="department" defaultValue={f.department}><option value="">Todos</option>{departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}</select></label>
    <label className="field"><span>Estado maestro</span><select name="state" defaultValue={f.state}><option value="">Todos</option>{Object.entries(administrativeLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
    <label className="field"><span>Revisión</span><input name="revision" defaultValue={f.revision} maxLength={2} placeholder="00"/></label>
    <label className="field"><span>Estado documental</span><select name="revisionState" defaultValue={f.revisionState}><option value="">Todos</option>{Object.keys(revisionLabels).map(key=><option value={key} key={key}>{documentStateLabel(key as keyof typeof revisionLabels)}</option>)}</select></label>
    <label className="field"><span>Plazos documentales</span><select name="validity" defaultValue={f.validity}><option value="">Todos</option><option value="current">Vigencia iniciada</option><option value="due">Revisión prevista alcanzada</option><option value="missing">Fechas sin completar</option></select></label>
    <fieldset className="pnt-date-range"><legend>Fecha de vigencia</legend><label className="field"><span>Desde</span><input type="date" name="effectiveFromStart" defaultValue={f.effectiveFromStart || ""}/></label><label className="field"><span>Hasta</span><input type="date" name="effectiveFromEnd" defaultValue={f.effectiveFromEnd || ""}/></label></fieldset>
    <fieldset className="pnt-date-range"><legend>Próxima revisión</legend><label className="field"><span>Desde</span><input type="date" name="reviewDueStart" defaultValue={f.reviewDueStart || ""}/></label><label className="field"><span>Hasta</span><input type="date" name="reviewDueEnd" defaultValue={f.reviewDueEnd || ""}/></label></fieldset>
    <label className="field"><span>Mostrar</span><select name="view" aria-describedby="pnt-latest-help" defaultValue={result.options.view}><option value="all">Todas las revisiones</option><option value="latest">Solo última revisión</option></select><small id="pnt-latest-help" className="section-help">Última = revisión con el número más alto de cada PNT, aunque esté en borrador; no necesariamente la vigente. Los filtros se aplican a esa revisión.</small></label>
    <label className="field"><span>Ordenar por</span><select name="sort" defaultValue={result.options.sort}>{headings.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="field"><span>Orden</span><select name="direction" defaultValue={result.options.direction}><option value="asc">Ascendente</option><option value="desc">Descendente</option></select></label>
    <div className="filter-actions"><button className="button primary" type="submit">Aplicar filtros</button><Link className="button" href="/controlled-documents">Limpiar</Link></div>
    </div></details>
   </form>{errors.length>0 && <p className="form-errors" role="alert">{errors.join(" ")}</p>}
  </section>
  <section className="pnt-results"><div className="pnt-section-heading"><div><h2>Resultados</h2><p>{result.rowCount} filas · {result.masterCount} PNT diferentes · {result.revisionCount} revisiones</p></div><PermissionGate permission="EXPORT"><Link className="button" href={exportLink}>Descargar .xlsx</Link></PermissionGate></div>
   <div className="table-card"><div className="table-wrap table-scroll pnt-table-scroll" tabIndex={0} role="region" aria-label="Listado maestro PNT; desplazamiento horizontal"><table className="data-table pnt-list-table"><thead><tr>{headings.map(([key,label])=><th scope="col" key={key}><Link href={link({sort:key,direction:result.options.sort===key&&result.options.direction==="asc"?"desc":"asc"})}>{label}{result.options.sort===key ? result.options.direction==="asc"?" ↑":" ↓":""}</Link></th>)}</tr></thead><tbody>{result.rows.map(({master,revision}) => {
     const dates=revision ? operationalDates(revision) : null;
     const origin=revision ? indexMetadata(revision.sourceMetadata) : null;
     return <tr key={master.id+":"+(revision?.id||"none")}><td><Link href={withReturnTo(`/controlled-documents/${master.id}`, returnTo)}>{master.baseCode||"Borrador sin código"}</Link></td><td><strong>{master.title||"Sin título"}</strong>{indexMetadata(master.sourceMetadata) && <p className="muted-note">Importado del índice</p>}</td><td>{master.departmentCodeSnapshot||"—"} — {master.departmentNameSnapshot||"—"}</td><td><span className="badge neutral">{administrativeLabels[master.administrativeStatus]}</span></td><td>{revision?.revisionCode||"—"}</td><td>{revision ? <DocumentStateBadge status={revision.status}/>:"—"}{origin && <p className="muted-note">Índice: {importStates[origin.declaredState]}</p>}</td><td>{dates?.effectiveFrom ? displayDate(dates.effectiveFrom):"—"}</td><td>{dates?.reviewDueAt ? displayDate(dates.reviewDueAt):"—"}</td></tr>;
   })}</tbody></table></div></div>
   {!result.rows.length && <div className="pnt-empty">No hay documentos que cumplan los filtros indicados.</div>}
   <p className="muted-note pnt-table-hint">Desplaza la tabla horizontalmente para consultar todas las columnas.</p>
   <nav className="pnt-pagination" aria-label="Paginación"><span>Página {result.page} de {result.pages} · 25 filas por página</span><div>{result.page>1 && <Link className="button" href={link({page:String(result.page-1)})}>Anterior</Link>}{result.page<result.pages && <Link className="button" href={link({page:String(result.page+1)})}>Siguiente</Link>}</div></nav>
  </section>
 </section>;
}

export default async function ListPage(...args: Parameters<typeof ListPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/page.tsx", () => ListPageAuthenticatedContent(...args), args);
}
