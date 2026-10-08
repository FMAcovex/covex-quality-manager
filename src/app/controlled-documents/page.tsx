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
    return <section className="workspace"><header><h1>Documentación controlada</h1><Link href="/controlled-documents/new">Nuevo PNT</Link> <Link href="/controlled-documents/import-index">Importar índice maestro</Link></header>
 <form className="inline-form" method="get">
 <label>Buscar<input name="q" defaultValue={f.q} placeholder="Código, título o referencia"/></label>
 <label>Departamento<select name="department" defaultValue={f.department}><option value="">Todos</option>{departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}{!d.isActive ? " (inactivo)" : ""}</option>)}</select></label>
 <label>Estado maestro<select name="state" defaultValue={f.state}><option value="">Todos</option>{Object.entries(administrativeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
 <label>Revisión<input name="revision" maxLength={2} placeholder="00" defaultValue={f.revision}/></label>
 <label>Estado documental<select name="revisionState" defaultValue={f.revisionState}><option value="">Todos</option>{Object.entries(revisionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
 <label>Vigencia<select name="validity" defaultValue={f.validity}><option value="">Todas</option><option value="current">Vigente</option><option value="due">Revisión prevista alcanzada</option><option value="missing">Fechas sin completar</option></select></label>
 <button>Filtrar</button><Link href="/controlled-documents">Limpiar filtros</Link></form>
 <p>{result.count} registros</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Código</th><th>Título</th><th>Departamento</th><th>Estado maestro</th><th>Revisiones</th><th>Vigencia / revisión prevista</th></tr></thead><tbody>{result.rows.map(m => <tr key={m.id}><td><Link href={`/controlled-documents/${m.id}`}>{m.baseCode || "Borrador sin código"}</Link></td><td>{m.title || "Sin título"}{indexMetadata(m.sourceMetadata) && <p>Importado del índice: pendiente de verificación documental. {importStates[indexMetadata(m.sourceMetadata)!.declaredState]}</p>}</td><td>{m.departmentCodeSnapshot} — {m.departmentNameSnapshot}</td><td>{administrativeLabels[m.administrativeStatus]}</td><td>{m.revisions.map(r => <div key={r.id}>{r.revisionCode} — {revisionLabels[r.status]}{indexMetadata(r.sourceMetadata) && <p>{importStates[indexMetadata(r.sourceMetadata)!.declaredState]} · pendiente de verificación documental</p>}</div>)}</td><td>{m.revisions.filter(r => r.status === "IN_FORCE").map(r => <div key={r.id}>{displayDate(r.effectiveFrom)} / {displayDate(r.reviewDueAt)}</div>)}</td></tr>)}</tbody></table></div>
 {!result.count && <p>No hay PNT para estos filtros.</p>}
 <nav aria-label="Paginación">{result.page > 1 && <Link href={pageLink(result.page - 1)}>Anterior</Link>} <span>Página {result.page} de {result.pages}</span> {result.page < result.pages && <Link href={pageLink(result.page + 1)}>Siguiente</Link>}</nav>
 </section>;
}
