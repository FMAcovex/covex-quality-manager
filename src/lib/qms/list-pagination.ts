export const QMS_LIST_PAGE_SIZE = 25;

export function qmsListPagination(total: number, requestedPage?: string) {
  const pageCount = Math.max(1, Math.ceil(total / QMS_LIST_PAGE_SIZE));
  const requested = Number(requestedPage);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  return { total, page, pageCount, pageSize: QMS_LIST_PAGE_SIZE };
}
