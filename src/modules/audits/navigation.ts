// The audit list is the only permitted destination for a restored search context.
export function auditListingReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 4000 || /[\\\r\n]/.test(value)) return "/audits";
  if (value === "/audits") return value;
  if (!value.startsWith("/audits?")) return "/audits";
  try {
    const url = new URL(value, "https://audits.invalid");
    if (url.origin !== "https://audits.invalid" || url.pathname !== "/audits" || url.hash) return "/audits";
    return url.pathname + url.search;
  } catch { /* Ruta de retorno no válida: se usa la predeterminada. */ return "/audits"; }
}
// Keeps a valid list return URL through tabs, edits, saves and in-record links.
export function auditWithReturnTo(path: string, value: unknown): string {
  const back = auditListingReturnTo(value);
  if (back === "/audits") return path;
  const url = new URL(path, "https://audits.invalid");
  if (url.origin !== "https://audits.invalid" || !url.pathname.startsWith("/audits/")) return path;
  url.searchParams.set("returnTo", back);
  return url.pathname + url.search + url.hash;
}
