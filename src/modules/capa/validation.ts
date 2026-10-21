import { rootCauseCategoriesFrom } from "@/lib/qms/root-cause-categories";
import { z } from "zod";
import { rowUserIdSchema } from "@/lib/qms/responsible-user";
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
  responsibleUserId: rowUserIdSchema,
  plannedExecutionDate: z.string().trim(),
  impact: z.string().trim(),
});
// D-117: la fila se lee sin exigir descripción para poder avisar en vez de descartarla en silencio.
const plannedActionRowSchema = plannedActionSchema.extend({ description: z.string().trim() });
const actionFollowupSchema = z.object({
  followupDate: z.string().trim(),
  description: z.string().trim(),
});
const originSchema = z.object({
  id: z.string().trim().min(1),
  recordType: z.enum(["DEVIATION", "COMPLAINT", "AUDIT"]),
  businessCode: z.string().trim(),
  year: z.number().nullable().optional(),
  displayLabel: z.string().optional(),
}).superRefine((value, context) => {
  if (value.recordType !== "AUDIT" && !value.businessCode) context.addIssue({ code: "custom", path: ["businessCode"], message: "La codificación de este origen es obligatoria." });
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
function parseArray<T>(raw: string | null, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => schema.safeParse(item)).filter((r): r is z.SafeParseSuccess<T> => r.success).map((r) => r.data);
  } catch { /* Entrada mal formada: se trata como vacía o no válida. */ return []; }
}
function validDate(value: string | null) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

export function parseCapaForm(formData: FormData, options: { allowHistoricalIncomplete?: boolean } = {}) {
  const submittedStatus = enumValue(status, text(formData, "status")) ?? "OPEN";
  const intent = (
    enumValue(saveIntent, text(formData, "saveIntent")) ??
    (submittedStatus === "DRAFT" ? "SAVE_DRAFT" : "UPDATE_CURRENT")
  ) as CapaSaveIntent;
  const recordStatus = intent === "SAVE_DRAFT"
    ? "DRAFT"
    : submittedStatus === "DRAFT"
      ? "OPEN"
      : submittedStatus;
  const businessCode = text(formData, "businessCode");
  const departmentId = text(formData, "departmentId");
  const openedAt = text(formData, "openedAt");
  const versionFollowupDate = text(formData, "versionFollowupDate");
  const createdByText = text(formData, "createdByText");
  const origins = parseArray<CapaOriginInput>(text(formData, "originsJson"), originSchema);
  const defectDescription = text(formData, "defectDescription");
  const rootCause = text(formData, "rootCause");
  const effectivenessStatus = enumValue(effectiveness, text(formData, "effectivenessStatus")) ?? "PENDING";
  const plannedActionRows = parseArray(text(formData, "plannedActionsJson"), plannedActionRowSchema);
  const plannedActions: CapaPlannedActionInput[] = plannedActionRows.filter((row) => row.description);
  const actionFollowups = parseArray<CapaActionFollowupInput>(text(formData, "actionFollowupsJson"), actionFollowupSchema);
  const nextFollowupDate = text(formData, "nextFollowupDate");
  const operationalClosedAt = text(formData, "operationalClosedAt");
  const effectiveClosedAt = text(formData, "effectiveClosedAt");
  const cancellationReason = text(formData, "cancellationReason");
  const operationalStatusDescription = text(formData, "operationalStatusDescription");
  const conclusion = text(formData, "conclusion");
  const actionFollowupObservations = text(formData, "actionFollowupObservations");
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
    if (!text(formData, "applicableTo")) addIssue("applicableTo", "Materia / material / producto / sistema / equipo es obligatorio.");
    if (!defectDescription) addIssue("defectDescription", "La descripción breve del defecto es obligatoria.");
    if (!rootCause && !options.allowHistoricalIncomplete) addIssue("rootCause", "La causa raíz es obligatoria.");
    if (!plannedActions.length) addIssue("plannedActionsJson", "Debe existir al menos una acción propuesta.");
    if (!actionFollowupObservations) addIssue("actionFollowupObservations", "Las observaciones del seguimiento de la acción son obligatorias.");
    if (!effectivenessAssessment) addIssue("effectivenessAssessment", "La evaluación de la eficacia es obligatoria.");
    if (!operationalStatusDescription) addIssue("operationalStatusDescription", "El estado operativo debe describirse.");
    if (!conclusion) addIssue("conclusion", "La conclusión es obligatoria.");
    const closedWithResolvedEffectiveness =
      recordStatus === "CLOSED" &&
      (effectivenessStatus === "CONFORMING" || effectivenessStatus === "NONCONFORMING");
    if (!closedWithResolvedEffectiveness && !nextFollowupDate) {
      addIssue("nextFollowupDate", "La fecha de próximo seguimiento es obligatoria.");
    }
  } else if (openedAt && !validDate(openedAt)) {
    addIssue("openedAt", "La fecha de apertura no tiene un formato válido.");
  }

  plannedActionRows.forEach((row, index) => {
    if (!row.description && (row.responsible || row.responsibleUserId || row.plannedExecutionDate || row.impact)) {
      addIssue("plannedActionsJson", `La acción propuesta ${index + 1} tiene datos pero no tiene descripción: complétala o quítala.`);
    }
  });
  plannedActions.forEach((item, index) => {
    if (item.plannedExecutionDate && !validDate(item.plannedExecutionDate)) addIssue("plannedActionsJson", `La fecha prevista de la acción ${index + 1} no tiene un formato válido.`);
  });
  actionFollowups.forEach((item, index) => {
    if (item.followupDate && !validDate(item.followupDate)) addIssue("actionFollowupsJson", `La fecha del seguimiento de acción ${index + 1} no tiene un formato válido.`);
    if (item.followupDate && !item.description) addIssue("actionFollowupsJson", `La descripción del seguimiento de acción ${index + 1} es obligatoria cuando se registra una fecha.`);
    if (item.description && !item.followupDate) addIssue("actionFollowupsJson", `La fecha del seguimiento de acción ${index + 1} es obligatoria cuando se registra una descripción.`);
  });
  for (const [field, value, message] of [
    ["nextFollowupDate", nextFollowupDate, "La fecha de próximo seguimiento no tiene un formato válido."],
    ["operationalClosedAt", operationalClosedAt, "La fecha de cierre y ejecución no tiene un formato válido."],
    ["effectiveClosedAt", effectiveClosedAt, "La fecha de verificación final no tiene un formato válido."],
  ] as const) if (value && !validDate(value)) addIssue(field, message);

  if (recordStatus === "CLOSED" && !options.allowHistoricalIncomplete && !operationalClosedAt) {
    addIssue("operationalClosedAt", "Una CAPA cerrada debe tener fecha de cierre y ejecución.");
  }
  if (effectivenessStatus === "CONFORMING" && !options.allowHistoricalIncomplete && !effectiveClosedAt) {
    addIssue("effectiveClosedAt", "La eficacia Conforme requiere fecha de verificación final.");
  }
  if (versionFollowupDate && !validDate(versionFollowupDate)) {
    addIssue("versionFollowupDate", "La fecha del seguimiento no tiene un formato válido.");
  }
  if (intent === "CREATE_FOLLOWUP_VERSION" && !versionFollowupDate) {
    addIssue("versionFollowupDate", "La fecha del seguimiento es obligatoria al crear un nuevo seguimiento.");
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
      departmentId, openedAt, versionFollowupDate, createdByText,
      origins,
      originType: firstOrigin?.recordType === "DEVIATION" ? "Desviación" : firstOrigin?.recordType === "COMPLAINT" ? "Reclamación" : firstOrigin?.recordType === "AUDIT" ? "Auditoría" : text(formData, "originType"),
      originCode: firstOrigin ? firstOrigin.businessCode || null : text(formData, "originCode"),
      applicableTo: text(formData, "applicableTo"),
      defectDescription, rootCause,
      rootCauseCategories: rootCauseCategoriesFrom(formData),
      impactAssessment: text(formData, "impactAssessment"),
      nextFollowupDate,
      actionFollowupObservations,
      actionFollowups,
      status: recordStatus,
      operationalStatusDescription,
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
