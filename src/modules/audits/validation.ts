import { z } from "zod";
import { compatibleAuditScenario, auditCodeYear } from "./domain";

const text = z.string().trim().max(20000).default("");
const date = z.string().refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), "Fecha no válida").default("");
const optionalEnum = <const T extends [string, ...string[]]>(values: T) => z.union([z.enum(values), z.literal("")]).default("");
const auditBaseSchema = z.object({
  auditType: optionalEnum(["INTERNAL", "EXTERNAL"]),
  scenario: optionalEnum(["INTERNAL_COVEX", "INTERNAL_CONTRACTED", "SUPPLIER", "CLIENT", "AUTHORITY"]),
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).default("DRAFT"),
  planningStatus: z.enum(["UNCLASSIFIED","PLANNED","OUT_OF_PLAN"]).default("UNCLASSIFIED"),
  planEntryId: z.string().uuid().or(z.literal("")).default(""),
  outsidePlanReason: text,
  title: text, scope: text, referenceText: text, externalReference: text,
  auditedEntityName: text, auditedEntityAddress: text, auditingEntityName: text, auditedContact: text,
  entityCode: z.string().trim().toUpperCase().max(40).default(""),
  codingDepartmentId: z.union([z.string().uuid(), z.literal("")]).default(""),
  departmentIds: z.array(z.string().uuid()).max(100).default([]),
  participants: z.array(z.object({
    id: z.string().uuid().optional(), displayName: z.string().trim().min(1, "Indica el nombre del participante").max(200),
    position: z.string().trim().max(200).default(""), organization: z.string().trim().max(200).default(""),
    role: z.enum(["LEAD_AUDITOR", "AUDITOR", "AUDITEE"]), sortOrder: z.number().int().min(0).max(10000),
  })).max(100).default([]),
  plannedDate: date, performedDate: date, openedAt: date,
  modality: optionalEnum(["ONSITE", "REMOTE", "HYBRID"]),
  businessCode: z.string().trim().max(100).default(""), internalObservations: text,
  dataQualityStatus: z.enum(["COMPLETE", "INCOMPLETE", "REVIEW_REQUIRED"]).default("INCOMPLETE"),
  actor: z.string().trim().min(1, "Indica quién realiza el cambio").max(200),
  changeReason: text, expectedUpdatedAt: z.string().default(""),
});
export const auditInputSchema = auditBaseSchema.superRefine((v, ctx) => {
  const add = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (!compatibleAuditScenario(v.auditType || null, v.scenario || null)) add("scenario", "El escenario no corresponde al tipo de auditoría.");
  // CLOSED is permitted when editing an already closed record; the service forbids direct closure transitions.
  if (v.planningStatus === "PLANNED" && !v.planEntryId) add("planEntryId","Selecciona una entrada del plan anual.");
  if (v.planningStatus !== "PLANNED" && v.planEntryId) add("planEntryId","Solo las auditorías planificadas se vinculan al plan.");
  if (v.planningStatus !== "OUT_OF_PLAN" && v.outsidePlanReason) add("outsidePlanReason","El motivo solo corresponde a auditorías fuera de plan.");
  if (new Set(v.departmentIds).size !== v.departmentIds.length) add("departmentIds", "No repitas departamentos.");
  const ids = v.participants.flatMap(p => p.id ? [p.id] : []);
  if (new Set(ids).size !== ids.length) add("participants", "No repitas el UUID de un participante.");
  if (v.entityCode && !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(v.entityCode)) add("entityCode", "El código de entidad admite letras, números, guion y guion bajo; sin espacios ni barras.");
  if (v.status === "DRAFT") return;
  for (const [key, label] of [["auditType", "tipo"], ["scenario", "escenario"], ["title", "objeto"], ["scope", "alcance"]] as const) if (!v[key]) add(key, `Indica el ${label} para abrir la auditoría.`);
  if (!v.performedDate && !v.plannedDate) add("plannedDate", "Indica la fecha prevista si la auditoría aún no se ha realizado.");
  if (!auditCodeYear(v)) add("openedAt", "Indica una fecha prevista, de apertura o realizada para identificar el año.");
  if (v.auditType === "INTERNAL") {
    if (!v.departmentIds.length) add("departmentIds", "Selecciona al menos un área/departamento.");
    if (!v.codingDepartmentId || !v.departmentIds.includes(v.codingDepartmentId)) add("codingDepartmentId", "El área de referencia para codificación debe estar entre las áreas auditadas.");
  }
  if (v.scenario === "SUPPLIER") {
    if (!v.auditedEntityName) add("auditedEntityName", "Indica la entidad auditada.");
    if (!v.entityCode) add("entityCode", "Indica el código de entidad para auditoría.");
  }
  const auditors = v.participants.filter(p => p.role !== "AUDITEE");
  if (!auditors.length) add("participants", "Añade al menos un auditor.");
  if (auditors.length > 1 && auditors.filter(p => p.role === "LEAD_AUDITOR").length !== 1) add("participants", "Con varios auditores, selecciona exactamente un auditor jefe.");
});
export type AuditInput = z.infer<typeof auditInputSchema>;
export function auditFormInput(fd: FormData) {
  const value = (key: string) => String(fd.get(key) ?? "");
  let participants: unknown = [];
  try { participants = JSON.parse(value("participants") || "[]"); } catch { participants = null; }
  return Object.fromEntries([
    ...Object.keys(auditBaseSchema.shape).filter(k => !["departmentIds", "participants"].includes(k)).map(k => [k, value(k)]),
    ["departmentIds", fd.getAll("departmentIds").map(String)], ["participants", participants],
  ]);
}
