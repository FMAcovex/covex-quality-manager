// R5B1: la pestaña Hallazgos edita un único elemento cada vez, indicado en la dirección (?edit=…).
export type FindingEdit =
  | { kind: "finding" | "action"; id: string }
  | { kind: "new-finding" }
  | { kind: "new-action" | "link" | "justify"; findingId: string }
  | null;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseFindingEdit(value: string | undefined): FindingEdit {
  if (value === "new-finding") return { kind: "new-finding" };
  const [kind, id] = (value ?? "").split(":");
  if (!id || !uuid.test(id)) return null;
  if (kind === "finding" || kind === "action") return { kind, id };
  if (kind === "new-action" || kind === "link" || kind === "justify") return { kind, findingId: id };
  return null;
}

export function findingEditHref(auditId: string, edit: string | null, anchor?: string) {
  return `/audits/${auditId}?tab=findings${edit ? `&edit=${encodeURIComponent(edit)}` : ""}${anchor ? `#${anchor}` : ""}`;
}
