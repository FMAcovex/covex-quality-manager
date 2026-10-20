import { legacyDeviationTab } from "@/modules/deviations/detail-tabs";
/**
 * UX C1: return to the exact QMS listing filter context without accepting
 * arbitrary destinations. Audit and PNT retain their existing navigation rules.
 */
export const qmsListRoots = ["/deviations", "/capa", "/changes", "/complaints", "/returns", "/oos"] as const;
export type QmsListRoot = (typeof qmsListRoots)[number];

export function qmsListingReturnTo(root: QmsListRoot, value: unknown): string {
  if (typeof value !== "string" || value.length > 4000 || /[\\\r\n]/.test(value)) return root;
  if (value === root) return root;
  if (!value.startsWith(root + "?")) return root;
  try {
    const parsed = new URL(value, "https://qms.invalid");
    return parsed.origin === "https://qms.invalid" && parsed.pathname === root && !parsed.hash
      ? parsed.pathname + parsed.search : root;
  } catch { /* Ruta de retorno no válida: se usa la predeterminada. */
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
  } catch { /* Ruta de retorno no válida: se usa la predeterminada. */
    return path;
  }
}

/** Known detail tabs only; never pass unchecked query strings to a redirect. */
const detailTabs: Record<QmsListRoot, readonly string[]> = {
  "/deviations": ["summary", "deviation", "relations", "versions", "documents", "review", "timeline"],
  "/capa": ["summary", "action-followups", "state", "relations", "versions", "documents", "review", "timeline"],
  "/changes": ["information", "request", "dictamen", "followups", "documents", "relations", "review", "timeline"],
  "/complaints": ["summary", "part-i", "part-ii", "relations", "documents", "versions", "review", "timeline"],
  "/returns": ["summary", "checks", "followups", "relations", "documents", "review", "timeline"],
  "/oos": ["summary", "phase-i", "phase-ii", "relations", "documents", "review", "timeline", "audit-trail"],
};
export type QmsReturnContext = { returnTo: string; tab: string };

export function qmsDetailTab(root: QmsListRoot, value: unknown): string {
  // D-111 (V3): Descripción, Investigación, Acciones y Conclusión son ahora apartados de «Desviación».
  if (root === "/deviations" && typeof value === "string" && legacyDeviationTab(value)) return "deviation";
  return typeof value === "string" && detailTabs[root].includes(value) ? value : "";
}

export function qmsDetailUrl(root: QmsListRoot, id: string, returnTo: unknown, tab: unknown): string {
  const selectedTab = qmsDetailTab(root, tab);
  const path = root + "/" + encodeURIComponent(id) + (selectedTab ? "?tab=" + selectedTab : "");
  return qmsWithReturnTo(path, root, returnTo);
}
