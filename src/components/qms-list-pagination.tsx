import Link from "next/link";
import { qmsListingUrl, type QmsListRoot } from "@/lib/qms/list-return-navigation";
import type { qmsListPagination } from "@/lib/qms/list-pagination";

export function QmsListPagination({ root, query, pagination }: {
  root: QmsListRoot;
  query: Record<string, string | string[] | undefined>;
  pagination: ReturnType<typeof qmsListPagination>;
}) {
  const href = (page: number) => qmsListingUrl(root, { ...query, page: String(page) });
  return <nav className="heading-actions qms-list-pagination" aria-label="Paginación de expedientes">
    <span>{pagination.total} resultados · Página {pagination.page} de {pagination.pageCount} · {pagination.pageSize} por página</span>
    {pagination.page > 1 && <Link className="button small" href={href(1)}>Primera</Link>}
    {pagination.page > 1 && <Link className="button small" href={href(pagination.page - 1)}>Anterior</Link>}
    {pagination.page < pagination.pageCount && <Link className="button small" href={href(pagination.page + 1)}>Siguiente</Link>}
    {pagination.page < pagination.pageCount && <Link className="button small" href={href(pagination.pageCount)}>Última</Link>}
  </nav>;
}
