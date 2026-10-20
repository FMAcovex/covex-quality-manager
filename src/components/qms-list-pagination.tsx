import Link from "next/link";
import { qmsListingUrl, type QmsListRoot } from "@/lib/qms/list-return-navigation";
import type { qmsListPagination } from "@/lib/qms/list-pagination";

/** Paginación común de los listados (D-117, H-10): mismo texto y mismos botones en todos los módulos. */
export function ListPagination({ total, page, pageCount, pageSize, href, label = "Paginación de expedientes" }: {
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  href: (page: number) => string;
  label?: string;
}) {
  const last = Math.max(1, pageCount);
  return <nav className="heading-actions qms-list-pagination" aria-label={label}>
    <span>{total} resultados · Página {page} de {last} · {pageSize} por página</span>
    {page > 1 && <Link className="button small" href={href(1)}>Primera</Link>}
    {page > 1 && <Link className="button small" href={href(page - 1)}>Anterior</Link>}
    {page < last && <Link className="button small" href={href(page + 1)}>Siguiente</Link>}
    {page < last && <Link className="button small" href={href(last)}>Última</Link>}
  </nav>;
}

export function QmsListPagination({ root, query, pagination }: {
  root: QmsListRoot;
  query: Record<string, string | string[] | undefined>;
  pagination: ReturnType<typeof qmsListPagination>;
}) {
  return <ListPagination total={pagination.total} page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
    href={(page) => qmsListingUrl(root, { ...query, page: String(page) })} />;
}
