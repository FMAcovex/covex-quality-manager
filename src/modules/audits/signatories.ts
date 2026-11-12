import { z } from "zod";

/**
 * D-134 (R6): firmantes de los documentos de una auditoría. Cada función admite varias personas
 * (por ejemplo, dos revisores). El informe usa «REPORT» y el CAPA plan «CAPA_PLAN».
 */
export const signatoryRoles = ["PREPARED", "REVIEWED", "APPROVED", "RECEIVED"] as const;
export type SignatoryRole = typeof signatoryRoles[number];
export const signatoryDocuments = ["REPORT", "CAPA_PLAN"] as const;
export type SignatoryDocument = typeof signatoryDocuments[number];
export type AuditSignatory = { document: SignatoryDocument; role: SignatoryRole; name: string; position: string };

export const signatoryRoleLabels: Record<SignatoryRole, string> = { PREPARED: "Elaborado por", REVIEWED: "Revisado por", APPROVED: "Aprobado por", RECEIVED: "Recibido por" };
/** Campos del formulario: una persona por línea, «Nombre | Puesto». */
export const reportSignatoryFields = { reportPreparedBy: "PREPARED", reportReviewedBy: "REVIEWED", reportApprovedBy: "APPROVED", reportReceivedBy: "RECEIVED" } as const satisfies Record<string, SignatoryRole>;
export const MAX_SIGNATORIES_PER_ROLE = 10;

const signatorySchema = z.object({
  document: z.enum(signatoryDocuments), role: z.enum(signatoryRoles),
  name: z.string().trim().min(1).max(200), position: z.string().trim().max(200),
});
export const signatoriesSchema = z.array(signatorySchema).max(signatoryDocuments.length * signatoryRoles.length * MAX_SIGNATORIES_PER_ROLE);

/** Lista guardada; una entrada no válida se ignora sin perder las demás, para no romper documentos. */
export function readSignatories(value: unknown): AuditSignatory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const parsed = signatorySchema.safeParse(item); return parsed.success ? [parsed.data] : []; });
}

type LegacySigners = { preparedBy?: string | null; preparedPosition?: string | null; reviewedBy?: string | null; reviewedPosition?: string | null; receivedBy?: string | null; receivedPosition?: string | null };
/**
 * Firmantes del informe. Los expedientes anteriores a D-134 solo tienen los campos de texto
 * «elaborado / revisado / recibido»: se usan mientras no se registre la lista.
 */
export function reportSignatories(audit: LegacySigners & { signatories?: unknown }): AuditSignatory[] {
  const list = readSignatories(audit.signatories).filter((s) => s.document === "REPORT");
  if (list.length) return list;
  const legacy: [SignatoryRole, string | null | undefined, string | null | undefined][] = [["PREPARED", audit.preparedBy, audit.preparedPosition], ["REVIEWED", audit.reviewedBy, audit.reviewedPosition], ["RECEIVED", audit.receivedBy, audit.receivedPosition]];
  return legacy.filter(([, name]) => name?.trim()).map(([role, name, position]) => ({ document: "REPORT", role, name: name!.trim(), position: position?.trim() ?? "" }));
}

/** «Nombre | Puesto» por línea. Las líneas vacías se ignoran. */
export function parseSignatoryLines(text: string, document: SignatoryDocument, role: SignatoryRole): AuditSignatory[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, ...position] = line.split("|");
    return { document, role, name: name.trim(), position: position.join("|").trim() };
  });
}
export function signatoryLines(list: AuditSignatory[], document: SignatoryDocument, role: SignatoryRole) {
  return list.filter((s) => s.document === document && s.role === role).map((s) => (s.position ? `${s.name} | ${s.position}` : s.name)).join("\n");
}

/** D-136 (R6): firmantes del plan CAPA (Anexo IV): elaborador, revisores y aprobadores. */
export const capaPlanSignatoryFields = { capaPlanPreparedBy: "PREPARED", capaPlanReviewedBy: "REVIEWED", capaPlanApprovedBy: "APPROVED" } as const satisfies Record<string, SignatoryRole>;

/** Errores por campo del formulario, o la lista completa de firmantes del documento. */
export function reportSignatoriesFromForm(values: Record<keyof typeof reportSignatoryFields, string>) {
  return signatoriesFromForm(values, reportSignatoryFields, "REPORT");
}
export function signatoriesFromForm(values: Record<string, string | undefined>, fields: Record<string, SignatoryRole>, document: SignatoryDocument) {
  const errors: Record<string, string> = {};
  const list: AuditSignatory[] = [];
  for (const [field, role] of Object.entries(fields)) {
    const people = parseSignatoryLines(values[field] ?? "", document, role);
    if (people.length > MAX_SIGNATORIES_PER_ROLE) errors[field] = `Como máximo ${MAX_SIGNATORIES_PER_ROLE} personas.`;
    else if (people.some((p) => !p.name)) errors[field] = "Cada línea necesita un nombre: «Nombre | Puesto».";
    else if (people.some((p) => p.name.length > 200 || p.position.length > 200)) errors[field] = "Nombre y puesto admiten 200 caracteres cada uno.";
    list.push(...people);
  }
  return { list, errors };
}

/** Las personas de las funciones enviadas sustituyen a las actuales; las demás funciones se conservan. */
export function mergeSignatoryRoles(current: AuditSignatory[], next: AuditSignatory[], sentRoles: SignatoryRole[]) {
  return signatoryRoles.flatMap(role => (sentRoles.includes(role) ? next : current).filter(s => s.role === role));
}
/** Sustituye los firmantes de un documento conservando los del otro. */
export function replaceDocumentSignatories(current: unknown, document: SignatoryDocument, next: AuditSignatory[]) {
  return [...readSignatories(current).filter((s) => s.document !== document), ...next];
}

/**
 * Los campos de texto anteriores para las plantillas previas a D-134, que tienen una casilla por función:
 * todas las personas, separadas por «; », para no perder firmantes. Revisores y aprobadores comparten la
 * casilla «Revisado por»; un puesto sin rellenar se indica con «—» para que los puestos sigan a sus nombres.
 */
export function legacySignerFields(list: AuditSignatory[]) {
  const people = (...roles: SignatoryRole[]) => roles.flatMap((role) => list.filter((s) => s.document === "REPORT" && s.role === role));
  const names = (p: AuditSignatory[]) => p.map((s) => s.name).join("; ");
  const positions = (p: AuditSignatory[]) => (p.some((s) => s.position) ? p.map((s) => s.position || "—").join("; ") : "");
  const prepared = people("PREPARED"), reviewed = people("REVIEWED", "APPROVED"), received = people("RECEIVED");
  return {
    preparedBy: names(prepared), preparedPosition: positions(prepared),
    reviewedBy: names(reviewed), reviewedPosition: positions(reviewed),
    receivedBy: names(received), receivedPosition: positions(received),
  };
}
