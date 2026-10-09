import { indexMetadata, importStates } from "@/modules/controlled-documents/import/domain";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { prisma } from "@/lib/db";
import { Filters, dateFilterErrors, listDocuments } from "@/modules/controlled-documents/queries";
import { administrativeLabels, revisionLabels, displayDate } from "@/modules/controlled-documents/domain";
import { manualStateLabels } from "@/modules/controlled-documents/manual-state/domain";
export const dynamic = "force-dynamic";
export default async function ListPage({ searchParams }: {
    searchParams: Promise<Filters>;
}) {
    const f = await searchParams;
    const filterErrors = dateFilterErrors(f);
    const [result, departments] = await Promise.all([listDocuments(f), prisma.department.findMany({ orderBy: { code: "asc" } })]);
    const pageLink = (page: number) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(f))
            if (typeof v === "string" && v)
                params.set(k, v);
        params.set("page", String(page));
        return `/controlled-documents?${params}`;
    };
    return <section className="workspace pnt-workspace"><header className="page-heading"><div><p className="eyebrow">Gestión documental · PNT</p><h1>Documentación controlada</h1></div><div className="heading-actions"><Link className="button primary" href="/controlled-documents/new">Nuevo PNT</Link><Link className="button" href="/controlled-documents/import-index">Importar índice maestro</Link></div></header>
 <form className="filter-panel pnt-filters" method="get">
 <label className="field"><span>Buscar</span><input name="q" defaultValue={f.q} placeholder="Código, título o referencia"/></label>
 <label className="field"><span>Departamento</span><select name="department" defaultValue={f.department}><option value="">Todos</option>{departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}{!d.isActive ? " (inactivo)" : ""}</option>)}</select></label>
 <label className="field"><span>Estado maestro</span><select name="state" defaultValue={f.state}><option value="">Todos</option>{Object.entries(administrativeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
 <label className="field"><span>Revisión</span><input name="revision" maxLength={2} placeholder="00" defaultValue={f.revision}/></label>
 <label className="field"><span>Estado documental</span><select name="revisionState" defaultValue={f.revisionState}><option value="">Todos</option>{Object.entries(revisionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
 <label className="field"><span>Plazos documentales</span><select name="validity" defaultValue={f.validity}><option value="">Todos</option><option value="current">Vigencia iniciada</option><option value="due">Revisión prevista alcanzada</option><option value="missing">Fechas sin completar</option></select></label>
 <fieldset className="pnt-date-range"><legend>Fecha de vigencia</legend><label className="field"><span>Desde</span><input type="date" name="effectiveFromStart" defaultValue={f.effectiveFromStart || ""}/></label><label className="field"><span>Hasta</span><input type="date" name="effectiveFromEnd" defaultValue={f.effectiveFromEnd || ""}/></label></fieldset>
 <fieldset className="pnt-date-range"><legend>Próxima revisión</legend><label className="field"><span>Desde</span><input type="date" name="reviewDueStart" defaultValue={f.reviewDueStart || ""}/></label><label className="field"><span>Hasta</span><input type="date" name="reviewDueEnd" defaultValue={f.reviewDueEnd || ""}/></label></fieldset>
 <div className="filter-actions"><button className="button primary">Filtrar</button><Link className="button" href="/controlled-documents">Limpiar filtros</Link></div></form>
 <p className="muted-note">{result.count} PNT encontrados · una fila por revisión</p><div className="table-card"><div className="table-wrap table-scroll pnt-table-scroll" tabIndex={0} role="region" aria-label="Listado maestro PNT; desplazamiento horizontal"><table className="data-table pnt-list-table"><thead><tr><th scope="col">Código</th><th scope="col">Título</th><th scope="col">Departamento</th><th scope="col">Estado maestro</th><th scope="col">Revisión</th><th scope="col">Estado documental</th><th scope="col">Fecha de vigencia</th><th scope="col">Próxima revisión</th></tr></thead><tbody>{result.rows.flatMap(m => (m.revisions.length ? m.revisions : [null]).map(r => <tr key={m.id + ":" + (r?.id || "none")}><td><Link href={`/controlled-documents/${m.id}`}>{m.baseCode || "Borrador sin código"}</Link></td><td>{m.title || "Sin título"}{indexMetadata(m.sourceMetadata) && <p className="muted-note">Importado del índice · {importStates[indexMetadata(m.sourceMetadata)!.declaredState]}</p>}</td><td>{m.departmentCodeSnapshot} — {m.departmentNameSnapshot}</td><td><span className="badge neutral">{administrativeLabels[m.administrativeStatus]}</span></td><td>{r?.revisionCode || "—"}</td><td>{r ? <span className={`badge pnt-state pnt-state--${r.status.toLowerCase().replaceAll("_", "-")}`}>{manualStateLabels[r.status as keyof typeof manualStateLabels] || revisionLabels[r.status]}</span> : "—"}{r && indexMetadata(r.sourceMetadata) && <p className="muted-note">Estado importado: {importStates[indexMetadata(r.sourceMetadata)!.declaredState]}</p>}</td><td>{r ? displayDate(r.lifecycle ? r.lifecycle.effectiveFrom : r.effectiveFrom) : "—"}</td><td>{r ? displayDate(r.lifecycle ? r.lifecycle.reviewDueAt : r.reviewDueAt) : "—"}</td></tr>))}</tbody></table></div></div>
 <p className="muted-note pnt-table-hint">Desplaza la tabla horizontalmente para consultar todas las columnas.</p>
 {!result.count && <p>No hay PNT para estos filtros.</p>}
 <nav className="pnt-pagination" aria-label="Paginación">{result.page > 1 && <Link className="button" href={pageLink(result.page - 1)}>Anterior</Link>} <span>Página {result.page} de {result.pages}</span> {result.page < result.pages && <Link className="button" href={pageLink(result.page + 1)}>Siguiente</Link>}</nav>
 </section>;
}
