import { z } from "zod";
import type { CapaPlannedActionInput } from "@/modules/capa/types";

const actionType = z.enum(["CORRECTIVE", "PREVENTIVE"]);
const status = z.enum(["OPEN", "CLOSED", "CANCELLED"]);
const effectiveness = z.enum(["CONFORMING", "NONCONFORMING", "PENDING", "NA"]);
const dataQuality = z.enum(["COMPLETE", "INCOMPLETE", "REVIEW_REQUIRED"]);

const plannedActionSchema = z.object({
  description: z.string().trim().min(1),
  responsible: z.string().trim(),
  plannedExecutionDate: z.string().trim(),
  impact: z.string().trim(),
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
    return parsed
      .map((item) => schema.safeParse(item))
      .filter((result): result is z.SafeParseSuccess<T> => result.success)
      .map((result) => result.data);
  } catch {
    return [];
  }
}

function validDate(value: string | null) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseCapaForm(
  formData: FormData,
  options: { allowHistoricalIncomplete?: boolean } = {},
) {
  const businessCode = text(formData, "businessCode");
  const departmentId = text(formData, "departmentId");
  const openedAt = text(formData, "openedAt");
  const createdByText = text(formData, "createdByText");
  const originType = text(formData, "originType");
  const originCode = text(formData, "originCode");
  const defectDescription = text(formData, "defectDescription");
  const rootCause = text(formData, "rootCause");
  const recordStatus = enumValue(status, text(formData, "status")) ?? "OPEN";
  const effectivenessStatus =
    enumValue(effectiveness, text(formData, "effectivenessStatus")) ?? "PENDING";
  const plannedActions = parseArray<CapaPlannedActionInput>(
    text(formData, "plannedActionsJson"),
    plannedActionSchema,
  );
  const operationalClosedAt = text(formData, "operationalClosedAt");
  const effectiveClosedAt = text(formData, "effectiveClosedAt");
  const cancellationReason = text(formData, "cancellationReason");
  const conclusion = text(formData, "conclusion");
  const effectivenessAssessment = text(formData, "effectivenessAssessment");

  const errors: string[] = [];
  const fieldIssues: Record<string, string[]> = {};
  const addIssue = (field: string, message: string) => {
    errors.push(message);
    fieldIssues[field] = [...(fieldIssues[field] ?? []), message];
  };


  if (!departmentId) addIssue("departmentId", "El departamento responsable es obligatorio.");
  if (!openedAt) addIssue("openedAt", "La fecha de apertura es obligatoria.");
  else if (!validDate(openedAt)) addIssue("openedAt", "La fecha de apertura no tiene un formato válido.");
  if (!createdByText) addIssue("createdByText", "Debe indicarse quién cumplimenta el registro.");
  if (!originType) addIssue("originType", "Debe indicarse el origen de la CAPA.");
  if (!defectDescription) addIssue("defectDescription", "La descripción breve del defecto es obligatoria.");
  if (!rootCause && !options.allowHistoricalIncomplete) addIssue("rootCause", "La causa raíz es obligatoria.");
  if (!plannedActions.length) addIssue("plannedActionsJson", "Debe existir al menos una acción propuesta.");

  plannedActions.forEach((action, index) => {
    if (action.plannedExecutionDate && !validDate(action.plannedExecutionDate)) {
      addIssue(
        "plannedActionsJson",
        `La fecha prevista de la acción ${index + 1} no tiene un formato válido.`,
      );
    }
  });

  if (operationalClosedAt && !validDate(operationalClosedAt)) {
    addIssue("operationalClosedAt", "La fecha de cierre operativo no tiene un formato válido.");
  }
  if (effectiveClosedAt && !validDate(effectiveClosedAt)) {
    addIssue("effectiveClosedAt", "La fecha de cierre efectivo no tiene un formato válido.");
  }

  if (recordStatus === "CLOSED" && !options.allowHistoricalIncomplete) {
    if (!operationalClosedAt) {
      addIssue("operationalClosedAt", "Una CAPA cerrada debe tener fecha de cierre operativo.");
    }
    if (!conclusion) {
      addIssue("conclusion", "Una CAPA cerrada debe tener conclusión de cierre.");
    }
  }

  if (recordStatus === "CANCELLED" && !cancellationReason && !options.allowHistoricalIncomplete) {
    addIssue("cancellationReason", "Una CAPA cancelada debe incluir el motivo de cancelación.");
  }

  if (effectiveClosedAt && !options.allowHistoricalIncomplete) {
    if (recordStatus !== "CLOSED") {
      addIssue("status", "El cierre efectivo solo puede registrarse cuando la CAPA está cerrada operativamente.");
    }
    if (effectivenessStatus !== "CONFORMING") {
      addIssue("effectivenessStatus", "El cierre efectivo requiere una verificación de eficacia Conforme.");
    }
    if (!effectivenessAssessment) {
      addIssue("effectivenessAssessment", "El cierre efectivo requiere una valoración documentada de la eficacia.");
    }
  }

  if (effectivenessStatus === "NONCONFORMING" && effectiveClosedAt && !options.allowHistoricalIncomplete) {
    addIssue("effectiveClosedAt", "Una eficacia No conforme no puede tener fecha de cierre efectivo.");
  }

  return {
    errors,
    fieldIssues,
    actor: text(formData, "modifiedByText") ?? createdByText ?? "Usuario no informado",
    values: {
      businessCode,
      actionType: enumValue(actionType, text(formData, "actionType")) ?? "CORRECTIVE",
      departmentId,
      openedAt,
      createdByText,
      originType,
      originCode,
      applicableTo: text(formData, "applicableTo"),
      defectDescription,
      rootCause,
      impactAssessment: text(formData, "impactAssessment"),
      status: recordStatus,
      cancellationReason,
      operationalClosedAt,
      effectivenessStatus,
      effectivenessCriteria: text(formData, "effectivenessCriteria"),
      effectivenessAssessment,
      effectivenessEvidence: text(formData, "effectivenessEvidence"),
      effectiveClosedAt,
      conclusion,
      internalObservations: text(formData, "internalObservations"),
      signedDocumentAvailable:
        text(formData, "signedDocumentAvailable") === "true"
          ? true
          : text(formData, "signedDocumentAvailable") === "false"
            ? false
            : null,
      dataQualityStatus:
        enumValue(dataQuality, text(formData, "dataQualityStatus")) ?? "REVIEW_REQUIRED",
      plannedActions,
      changeReason: text(formData, "changeReason"),
      fromDeviationPlanId: text(formData, "fromDeviationPlanId"),
      fromComplaintPlanId: text(formData, "fromComplaintPlanId"),
      fromComplaintId: text(formData, "fromComplaintId"),
    },
  };
}
