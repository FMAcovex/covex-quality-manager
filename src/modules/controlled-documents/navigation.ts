// Only a local PNT listing is an accepted navigation destination.
export function listingReturnTo(value: unknown): string {
  if (typeof value !== "string" || /[\\\r\n]/.test(value)) return "/controlled-documents";
  try {
    const url = new URL(value, "https://pnt.invalid");
    return value.startsWith("/controlled-documents?") && url.origin === "https://pnt.invalid" && url.pathname === "/controlled-documents" && !url.hash
      ? url.pathname + url.search : "/controlled-documents";
  } catch { /* Ruta de retorno no válida: se usa la predeterminada. */ return "/controlled-documents"; }
}
export function withReturnTo(path: string, value: unknown): string {
  const back = listingReturnTo(value);
  return back === "/controlled-documents" ? path : path + (path.includes("?") ? "&" : "?") + "returnTo=" + encodeURIComponent(back);
}
export function listingQuery(filters: Record<string, unknown>, changes: Record<string, string> = {}, resetPage = false): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (typeof value === "string" && value && !(resetPage && key === "page")) p.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value) p.set(key, value); else p.delete(key);
  }
  return p.toString();
}
