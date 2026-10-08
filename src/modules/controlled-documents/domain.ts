import { z } from "zod";
export const administrativeLabels = { DRAFT: "Borrador de registro", ACTIVE: "Activo en registro", ANNULLED: "Anulado" };
export const revisionLabels = { IMPORTED_PENDING: "Importada / pendiente de verificación", DRAFT: "Borrador / en elaboración", IN_REVIEW: "En revisión", PENDING_APPROVAL: "Pendiente de aprobación", APPROVED_PENDING_EFFECTIVE: "Aprobado / pendiente de vigencia", IN_FORCE: "Vigente", OBSOLETE: "Obsoleto", ANNULLED: "Anulado" };
export const verificationLabels = { UNVERIFIED: "Sin verificar", VERIFIED: "Verificado documentalmente", REVIEW_REQUIRED: "Requiere contraste documental" };
export const existingStatuses = ["IN_FORCE", "OBSOLETE", "ANNULLED"] as const;
export type ExistingStatus = typeof existingStatuses[number];
export function normalizeBaseCode(value: string) { return value.trim().toUpperCase(); }
export function validBaseCode(value: string) { return /^[A-Z]{2}-\d{2}\/\d{3}$/.test(value); }
export function validRevisionCode(value: string) { return /^\d{2}$/.test(value); }
export function validDate(value: string) { return !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value); }
export const iso = (v: Date | string | null | undefined) => v ? new Date(v).toISOString().slice(0, 10) : "";
export function displayDate(v: Date | string | null | undefined) { const date = iso(v); return date ? date.split("-").reverse().join("/") : "—"; }
const text = (max: number) => z.string().trim().max(max, "El texto supera la longitud permitida.");
const calendar = z.string().refine(validDate, "La fecha no es válida.");
const revisionFields = { revisionCode: text(2).refine(v => !v || validRevisionCode(v), "La revisión debe tener dos cifras, incluida 00."), revisionReason: text(8000), effectiveFrom: calendar, reviewDueAt: calendar, obsoletedAt: calendar, previousRevisionId: z.union([z.literal(""), z.string().uuid("La revisión anterior no es válida.")]), sourceReference: text(2000), existingDocument: z.boolean(), verified: z.boolean(), existingStatus: z.enum(existingStatuses) };
const masterSchema = z.object({ baseCode: text(30).transform(normalizeBaseCode).refine(v => !v || validBaseCode(v), "Usa el código base AB-XX/YYY, sin revisión ni año."), title: text(500), departmentId: z.union([z.literal(""), z.string().uuid("El departamento no es válido.")]), documentType: z.literal("PNT"), observations: text(8000), actor: text(200).min(1, "Indica el responsable del registro."), changeReason: text(8000), operation: z.enum(["DRAFT", "REGISTER", "EDIT"]), updatedAt: z.string(), ...revisionFields });
export type MasterInput = z.infer<typeof masterSchema>;
const revisionSchema = z.object({ ...revisionFields, revisionCode: text(2).refine(validRevisionCode, "Indica la revisión explícita de dos cifras."), actor: text(200).min(1, "Indica el responsable del registro."), changeReason: text(8000).min(1, "Indica el motivo del registro o cambio."), updatedAt: z.string(), operation: z.enum(["DRAFT", "REGISTER"]) });
export type RevisionInput = z.infer<typeof revisionSchema>;
function field(fd: FormData, key: string) { const v = fd.get(key); return typeof v === "string" ? v : ""; }
function values(fd: FormData) { const names = ["baseCode", "title", "departmentId", "documentType", "observations", "actor", "changeReason", "operation", "updatedAt", "revisionCode", "revisionReason", "effectiveFrom", "reviewDueAt", "obsoletedAt", "previousRevisionId", "sourceReference", "existingStatus"]; return { ...Object.fromEntries(names.map(k => [k, field(fd, k)])), existingDocument: field(fd, "existingDocument") === "on", verified: field(fd, "verified") === "on", existingStatus: field(fd, "existingStatus") || "IN_FORCE", documentType: field(fd, "documentType") || "PNT" }; }
export function parseMasterForm(fd: FormData) {
    const r = masterSchema.safeParse(values(fd));
    if (!r.success)
        throw new Error(r.error.issues.map(x => x.message).join(" "));
    if (r.data.operation !== "DRAFT" && !r.data.changeReason)
        throw new Error("Indica el motivo del registro o cambio.");
    if (!r.data.revisionCode && (r.data.revisionReason || r.data.effectiveFrom || r.data.reviewDueAt || r.data.obsoletedAt || r.data.sourceReference || r.data.existingDocument))
        throw new Error("Indica la revisión explícita para conservar sus fechas, motivo y referencia documental.");
    return r.data;
}
export function parseRevisionForm(fd: FormData) {
    const r = revisionSchema.safeParse(values(fd));
    if (!r.success)
        throw new Error(r.error.issues.map(x => x.message).join(" "));
    return r.data;
}
export function validateRevisionDates(v: Pick<RevisionInput, "effectiveFrom" | "reviewDueAt" | "obsoletedAt">) {
    if (v.effectiveFrom && v.reviewDueAt && v.reviewDueAt < v.effectiveFrom)
        throw new Error("La fecha prevista de revisión no puede preceder a la vigencia.");
    if (v.effectiveFrom && v.obsoletedAt && v.obsoletedAt < v.effectiveFrom)
        throw new Error("La obsolescencia no puede preceder a la vigencia.");
}
export function validateExistingRevision(v: Pick<RevisionInput, "existingDocument" | "verified" | "sourceReference" | "existingStatus" | "effectiveFrom" | "obsoletedAt">, today = iso(new Date())) {
    if (!v.existingDocument || !v.verified || !v.sourceReference)
        throw new Error("El registro de una revisión existente exige referencia documental y confirmación de verificación.");
    if (v.existingStatus === "IN_FORCE" && (!v.effectiveFrom || v.effectiveFrom > today))
        throw new Error("Una revisión registrada como vigente requiere fecha de vigencia alcanzada.");
    if (v.existingStatus === "IN_FORCE" && v.obsoletedAt)
        throw new Error("Una revisión vigente no puede tener fecha de obsolescencia.");
}
