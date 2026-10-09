import { indexMetadata, importStates } from "@/modules/controlled-documents/import/domain";
import { DocumentLink as Link } from "@/modules/controlled-documents/components/document-link";
import { prisma } from "@/lib/db";
import { Filters, listDocuments } from "@/modules/controlled-documents/queries";
import { administrativeLabels, revisionLabels, displayDate } from "@/modules/controlled-documents/domain";
export const dynamic = "force-dynamic";
export default async function ListPage({ searchParams }: {
    searchParams: Promise<Filters>;
}) {
    const f = await searchParams;
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
 <label className="field"><span>Vigencia</span><select name="validity" defaultValue={f.validity}><option value="">Todas</option><option value="current">Vigente</option><option value="due">Revisión prevista alcanzada</option><option value="missing">Fechas sin completar</option></select></label>
 <div className="filter-actions"><button className="button primary">Filtrar</button><Link className="button" href="/controlled-documents">Limpiar filtros</Link></div></form>
 <p className="muted-note">{result.count} registros</p><div className="table-card"><div className="table-wrap table-scroll pnt-table-scroll" tabIndex={0} role="region" aria-label="Listado maestro PNT; desplazamiento horizontal"><table className="data-table pnt-list-table"><thead><tr><th scope="col">Código</th><th scope="col">Título</th><th scope="col">Departamento</th><th scope="col">Estado maestro</th><th scope="col">Revisiones</th><th scope="col">Vigencia / revisión prevista</th></tr></thead><tbody>{result.rows.map(m => <tr key={m.id}><td><Link href={`/controlled-documents/${m.id}`}>{m.baseCode || "Borrador sin código"}</Link></td><td>{m.title || "Sin título"}{indexMetadata(m.sourceMetadata) && <p className="muted-note">Importado del índice: {m.revisions.every(r => r.verificationStatus !== "VERIFIED") ? "pendiente de verificación documental." : "contraste registrado por revisión."} {importStates[indexMetadata(m.sourceMetadata)!.declaredState]}</p>}</td><td>{m.departmentCodeSnapshot} — {m.departmentNameSnapshot}</td><td><span className="badge neutral">{administrativeLabels[m.administrativeStatus]}</span></td><td>{m.revisions.map(r => <div className="pnt-list-revision" key={r.id}><strong>{r.revisionCode}</strong> — {revisionLabels[r.status]}{indexMetadata(r.sourceMetadata) && <p className="muted-note">{importStates[indexMetadata(r.sourceMetadata)!.declaredState]} · {r.verificationStatus !== "VERIFIED" ? "pendiente de verificación documental" : "contraste registrado"}</p>}</div>)}</td><td>{m.revisions.filter(r => r.status === "IN_FORCE").map(r => <div className="pnt-list-dates" key={r.id}>{displayDate(r.lifecycle ? r.lifecycle.effectiveFrom : r.effectiveFrom)} / {displayDate(r.lifecycle ? r.lifecycle.reviewDueAt : r.reviewDueAt)}</div>)}</td></tr>)}</tbody></table></div></div>
 <p className="muted-note pnt-table-hint">Desplaza la tabla horizontalmente para consultar todas las columnas.</p>
 {!result.count && <p>No hay PNT para estos filtros.</p>}
 <nav className="pnt-pagination" aria-label="Paginación">{result.page > 1 && <Link className="button" href={pageLink(result.page - 1)}>Anterior</Link>} <span>Página {result.page} de {result.pages}</span> {result.page < result.pages && <Link className="button" href={pageLink(result.page + 1)}>Siguiente</Link>}</nav>
 </section>;
}
