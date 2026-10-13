/** Stable command/metadata hashing, without serializing credentials or sessions. */
export function canonicalAuditJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalAuditJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([key,item]) => JSON.stringify(key) + ":" + canonicalAuditJson(item)).join(",") + "}";
  return JSON.stringify(value);
}
