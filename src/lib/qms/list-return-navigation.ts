/**
 * UX C1: return to the exact QMS listing filter context without accepting
 * arbitrary destinations. Audit and PNT retain their existing navigation rules.
 */
export const qmsListRoots = ["/deviations", "/capa", "/changes", "/complaints", "/returns"] as const;
export type QmsListRoot = (typeof qmsListRoots)[number];

export function qmsListingReturnTo(root: QmsListRoot, value: unknown): string {
  if (typeof value !== "string" || value.length > 4000 || /[\\\r\n]/.test(value)) return root;
  if (value === root) return root;
  if (!value.startsWith(root + "?")) return root;
  try {
    const parsed = new URL(value, "https://qms.invalid");
    return parsed.origin === "https://qms.invalid" && parsed.pathname === root && !parsed.hash
      ? parsed.pathname + parsed.search : root;
  } catch {
    return root;
  }
}

export function qmsListingUrl(root: QmsListRoot, query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (key === "returnTo") continue;
    for (const value of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      if (value) params.append(key, value);
    }
  }
  const candidate = params.size ? root + "?" + params.toString() : root;
  return qmsListingReturnTo(root, candidate);
}

export function qmsWithReturnTo(path: string, root: QmsListRoot, value: unknown): string {
  const returnTo = qmsListingReturnTo(root, value);
  if (returnTo === root) return path;
  try {
    const url = new URL(path, "https://qms.invalid");
    if (url.origin !== "https://qms.invalid" || !url.pathname.startsWith(root + "/")) return path;
    url.searchParams.set("returnTo", returnTo);
    return url.pathname + url.search + url.hash;
  } catch {
    return path;
  }
}
