/** Source metadata only: keep each candidate/operation reviewable on one line. */
export function auditManifestJson(value: Record<string, unknown>): string {
  const fields = Object.entries(value).map(([key, item]) => {
    let encoded: string;
    if (Array.isArray(item)) encoded = "[\n" + item.map(row => "    " + JSON.stringify(row)).join(",\n") + "\n  ]";
    else if (item && typeof item === "object") encoded = "{\n" + Object.entries(item).map(([name,row]) => "    " + JSON.stringify(name) + ": " + JSON.stringify(row)).join(",\n") + "\n  }";
    else encoded = JSON.stringify(item);
    return "  " + JSON.stringify(key) + ": " + encoded;
  });
  return "{\n" + fields.join(",\n") + "\n}\n";
}
