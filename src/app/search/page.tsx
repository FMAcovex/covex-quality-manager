import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page-guard";
import { GLOBAL_SEARCH_MIN_LENGTH, normalizeGlobalQuery } from "@/modules/search/ranking";
import { globalSearch } from "@/modules/search-registry";

export const dynamic = "force-dynamic";

type Query = { q?: string | string[] };

async function SearchPageContent({ searchParams }: { searchParams: Promise<Query> }) {
  const raw = (await searchParams).q;
  const query = normalizeGlobalQuery(raw);
  const groups = query ? await globalSearch(query) : [];
  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Búsqueda</p>
          <h1>{query ? `Resultados para «${query}»` : "Buscar expedientes"}</h1>
          <p>Código, lote, título o descripción en todos los módulos. La búsqueda completa de cada módulo está en su listado.</p>
        </div>
      </div>
      <form className="global-search" action="/search" method="get" role="search">
        <label className="visually-hidden" htmlFor="global-search-input">Buscar en todos los módulos</label>
        <input id="global-search-input" name="q" type="search" defaultValue={query ?? (typeof raw === "string" ? raw : "")} placeholder="Código, lote, título o descripción" minLength={GLOBAL_SEARCH_MIN_LENGTH} maxLength={100} autoComplete="off" autoFocus />
        <button className="button primary" type="submit">Buscar</button>
      </form>
      {!query ? (
        <div className="card empty-panel">Escribe al menos {GLOBAL_SEARCH_MIN_LENGTH} caracteres para buscar.</div>
      ) : !groups.length ? (
        <div className="card empty-panel">No hay expedientes que coincidan con «{query}».</div>
      ) : groups.map((group) => (
        <section className="card global-search-group" key={group.key} aria-labelledby={`search-${group.key}`}>
          <h2 id={`search-${group.key}`}>{group.label}</h2>
          <ul className="global-search-hits">
            {group.hits.map((hit) => (
              <li key={hit.id}>
                <Link href={hit.href}><strong>{hit.code}</strong></Link>
                {hit.annulled ? <span className="badge neutral">Anulado</span> : null}
                {hit.summary ? <span className="global-search-summary">{hit.summary}</span> : null}
              </li>
            ))}
          </ul>
          <Link className="muted-note" href={group.listHref}>{group.more ? "Ver todos en el listado" : "Abrir en el listado"} →</Link>
        </section>
      ))}
    </section>
  );
}

export default async function SearchPage(...args: Parameters<typeof SearchPageContent>) {
  return authorizedPage("src/app/search/page.tsx", () => SearchPageContent(...args), args);
}
