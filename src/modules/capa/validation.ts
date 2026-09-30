import { z } from "zod";
import type {
  CapaActionFollowupInput,
  CapaOriginInput,
  CapaPlannedActionInput,
  CapaSaveIntent,
} from "@/modules/capa/types";

const actionType = z.enum(["CORRECTIVE", "PREVENTIVE"]);
const status = z.enum(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);
const effectiveness = z.enum(["CONFORMING", "NONCONFORMING", "PENDING", "NA"]);
const dataQuality = z.enum(["COMPLETE", "INCOMPLETE", "REVIEW_REQUIRED"]);
const saveIntent = z.enum(["SAVE_DRAFT", "UPDATE_CURRENT", "CREATE_FOLLOWUP_VERSION"]);

const plannedActionSchema = z.object({
  description: z.string().trim().min(1),
  responsible: z.string().trim(),
  plannedExecutionDate: z.string().trim(),
  impact: z.string().trim(),
});
const actionFollowupSchema = z.object({
  followupDate: z.string().trim(),
  description: z.string().trim(),
});
const originSchema = z.object({
  id: z.string().trim().min(1),
  recordType: z.enum(["DEVIATION", "COMPLAINT"]),
  businessCode: z.string().trim().min(1),
  year: z.number().nullable().optional(),
});

function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
function enumValue<T extends z.ZodTypeAny>(schema: T, value: string | null) {
  if (!value) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function parseArray<T>(raw: string | null, schema: z.ZodType<T>): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => schema.safeParse(item)).filter((r): r is z.SafeParseSuccess<T> => r.success).map((r) => r.data);
  } catch { return []; }
}
function validDate(value: string | null) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

export function parseCapaForm(formData: FormData, options: { allowHistoricalIncomplete?: boolean } = {}) {
  const intent = (enumValue(saveIntent, text(formData, "saveIntent")) ?? "UPDATE_CURRENT") as CapaSaveIntent;
  const submittedStatus = enumValue(status, text(formData, "status")) ?? "OPEN";
  const recordStatus = intent === "SAVE_DRAFT"
    ? "DRAFT"
    : submittedStatus === "DRAFT"
      ? "OPEN"
      : submittedStatus;
  const businessCode = text(formData, "businessCode");
  const departmentId = text(formData, "departmentId");
  const openedAt = text(formData, "openedAt");
  const createdByText = text(formData, "createdByText");
  const origins = parseArray<CapaOriginInput>(text(formData, "originsJson"), originSchema);
  const defectDescription = text(formData, "defectDescription");
  const rootCause = text(formData, "rootCause");
  const effectivenessStatus = enumValue(effectiveness, text(formData, "effectivenessStatus")) ?? "PENDING";
  const plannedActions = parseArray<CapaPlannedActionInput>(text(formData, "plannedActionsJson"), plannedActionSchema);
  const actionFollowups = parseArray<CapaActionFollowupInput>(text(formData, "actionFollowupsJson"), actionFollowupSchema);
  const nextFollowupDate = text(formData, "nextFollowupDate");
  const operationalClosedAt = text(formData, "operationalClosedAt");
  const effectiveClosedAt = text(formData, "effectiveClosedAt");
  const cancellationReason = text(formData, "cancellationReason");
  const conclusion = text(formData, "conclusion");
  const effectivenessAssessment = text(formData, "effectivenessAssessment");
  const changeReason = text(formData, "changeReason");

  const errors: string[] = [];
  const fieldIssues: Record<string, string[]> = {};
  const addIssue = (field: string, message: string) => {
    errors.push(message);
    fieldIssues[field] = [...(fieldIssues[field] ?? []), message];
  };

  if (recordStatus !== "DRAFT") {
    if (!departmentId) addIssue("departmentId", "El departamento responsable es obligatorio.");
    if (!openedAt) addIssue("openedAt", "La fecha de apertura es obligatoria.");
    else if (!validDate(openedAt)) addIssue("openedAt", "La fecha de apertura no tiene un formato válido.");
    if (!createdByText) addIssue("createdByText", "Debe indicarse quién cumplimenta el registro.");
    if (!origins.length && !text(formData, "fromDeviationPlanId") && !text(formData, "fromComplaintPlanId") && !text(formData, "fromComplaintId")) {
      addIssue("originsJson", "Debe indicarse al menos un expediente de origen.");
    }
    if (!defectDescription) addIssue("defectDescription", "La descripción breve del defecto es obligatoria.");
    if (!rootCause && !options.allowHistoricalIncomplete) addIssue("rootCause", "La causa raíz es obligatoria.");
    if (!plannedActions.length) addIssue("plannedActionsJson", "Debe existir al menos una acción propuesta.");
  } else if (openedAt && !validDate(openedAt)) {
    addIssue("openedAt", "La fecha de apertura no tiene un formato válido.");
  }

  plannedActions.forEach((item, index) => {
    if (item.plannedExecutionDate && !validDate(item.plannedExecutionDate)) addIssue("plannedActionsJson", `La fecha prevista de la acción ${index + 1} no tiene un formato válido.`);
  });
  actionFollowups.forEach((item, index) => {
    if (item.followupDate && !validDate(item.followupDate)) addIssue("actionFollowupsJson", `La fecha del seguimiento de acción ${index + 1} no tiene un formato válido.`);
  });
  for (const [field, value, message] of [
    ["nextFollowupDate", nextFollowupDate, "La fecha de próximo seguimiento no tiene un formato válido."],
    ["operationalClosedAt", operationalClosedAt, "La fecha de cierre y ejecución no tiene un formato válido."],
    ["effectiveClosedAt", effectiveClosedAt, "La fecha de verificación final no tiene un formato válido."],
  ] as const) if (value && !validDate(value)) addIssue(field, message);

  if (recordStatus === "CLOSED" && !options.allowHistoricalIncomplete) {
    if (!operationalClosedAt) addIssue("operationalClosedAt", "Una CAPA cerrada debe tener fecha de cierre y ejecución.");
    if (!conclusion) addIssue("conclusion", "Una CAPA cerrada debe tener conclusión de cierre.");
  }
  if (recordStatus === "CANCELLED" && !cancellationReason && !options.allowHistoricalIncomplete) addIssue("cancellationReason", "Una CAPA cancelada debe incluir el motivo de cancelación.");
  if (effectivenessStatus !== "PENDING" && effectivenessStatus !== "NA" && !effectiveClosedAt && !options.allowHistoricalIncomplete) {
    addIssue("effectiveClosedAt", "La fecha de verificación final es obligatoria cuando la eficacia deja de estar Pendiente.");
  }
  if (effectiveClosedAt && !options.allowHistoricalIncomplete) {
    if (recordStatus !== "CLOSED") addIssue("status", "La verificación final solo puede registrarse cuando la CAPA está cerrada operativamente.");
    if (effectivenessStatus === "CONFORMING" && !effectivenessAssessment) addIssue("effectivenessAssessment", "La eficacia Conforme requiere una evaluación documentada.");
  }
  if (intent === "CREATE_FOLLOWUP_VERSION" && !changeReason) addIssue("changeReason", "El motivo del nuevo seguimiento es obligatorio.");

  const firstOrigin = origins[0];
  return {
    errors, fieldIssues,
    actor: text(formData, "modifiedByText") ?? createdByText ?? "Usuario no informado",
    values: {
      saveIntent: intent,
      businessCode,
      actionType: enumValue(actionType, text(formData, "actionType")) ?? "CORRECTIVE",
      departmentId, openedAt, createdByText,
      origins,
      originType: firstOrigin?.recordType === "DEVIATION" ? "Desviación" : firstOrigin?.recordType === "COMPLAINT" ? "Reclamación" : text(formData, "originType"),
      originCode: firstOrigin?.businessCode ?? text(formData, "originCode"),
      applicableTo: text(formData, "applicableTo"),
      defectDescription, rootCause,
      impactAssessment: text(formData, "impactAssessment"),
      nextFollowupDate,
      actionFollowupObservations: text(formData, "actionFollowupObservations"),
      actionFollowups,
      status: recordStatus,
      cancellationReason, operationalClosedAt,
      effectivenessStatus,
      effectivenessCriteria: text(formData, "effectivenessCriteria"),
      effectivenessAssessment,
      effectivenessEvidence: text(formData, "effectivenessEvidence"),
      effectiveClosedAt, conclusion,
      internalObservations: text(formData, "internalObservations"),
      signedDocumentAvailable: text(formData, "signedDocumentAvailable") === "true" ? true : text(formData, "signedDocumentAvailable") === "false" ? false : null,
      dataQualityStatus: enumValue(dataQuality, text(formData, "dataQualityStatus")) ?? "REVIEW_REQUIRED",
      plannedActions,
      changeReason,
      fromDeviationPlanId: text(formData, "fromDeviationPlanId"),
      fromComplaintPlanId: text(formData, "fromComplaintPlanId"),
      fromComplaintId: text(formData, "fromComplaintId"),
    },
  };
}
