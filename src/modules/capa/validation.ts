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
  if (!businessCode) errors.push("La codificación AC/AP es obligatoria.");
  if (!departmentId) errors.push("El departamento responsable es obligatorio.");
  if (!openedAt) errors.push("La fecha de apertura es obligatoria.");
  if (!createdByText) errors.push("Debe indicarse quién cumplimenta el registro.");
  if (!originType) errors.push("Debe indicarse el origen de la CAPA.");
  if (!defectDescription) errors.push("La descripción breve del defecto es obligatoria.");
  if (!rootCause && !options.allowHistoricalIncomplete) errors.push("La causa raíz es obligatoria.");
  if (!plannedActions.length) errors.push("Debe existir al menos una acción propuesta.");

  if (recordStatus === "CLOSED" && !options.allowHistoricalIncomplete) {
    if (!operationalClosedAt) {
      errors.push("Una CAPA cerrada debe tener fecha de cierre operativo.");
    }
    if (!conclusion) {
      errors.push("Una CAPA cerrada debe tener conclusión de cierre.");
    }
  }

  if (recordStatus === "CANCELLED" && !cancellationReason && !options.allowHistoricalIncomplete) {
    errors.push("Una CAPA cancelada debe incluir el motivo de cancelación.");
  }

  if (effectiveClosedAt && !options.allowHistoricalIncomplete) {
    if (recordStatus !== "CLOSED") {
      errors.push("El cierre efectivo solo puede registrarse cuando la CAPA está cerrada operativamente.");
    }
    if (effectivenessStatus !== "CONFORMING") {
      errors.push("El cierre efectivo requiere una verificación de eficacia Conforme.");
    }
    if (!effectivenessAssessment) {
      errors.push("El cierre efectivo requiere una valoración documentada de la eficacia.");
    }
  }

  if (effectivenessStatus === "NONCONFORMING" && effectiveClosedAt && !options.allowHistoricalIncomplete) {
    errors.push("Una eficacia No conforme no puede tener fecha de cierre efectivo.");
  }

  return {
    errors,
    actor: text(formData, "modifiedByText") ?? createdByText ?? "Usuario no informado",
    values: {
      businessCode,
      actionType: enumValue(actionType, text(formData, "actionType")) ?? "CORRECTIVE",
      departmentId,
      openedAt,
      createdByText,
      issuedByRole: text(formData, "issuedByRole"),
      approvalNames: text(formData, "approvalNames"),
      approvalRoles: text(formData, "approvalRoles"),
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
    },
  };
}
