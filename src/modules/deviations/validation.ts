import { z } from "zod";
import type { CapaPlanInput, ImmediateActionInput } from "@/modules/deviations/types";

const triState = z.enum(["YES", "NO", "NA"]);
const classification = z.enum(["CRITICAL", "MAJOR", "MINOR"]);
const status = z.enum(["OPEN", "CLOSED"]);
const dataQuality = z.enum(["COMPLETE", "INCOMPLETE", "REVIEW_REQUIRED"]);

const immediateActionSchema = z.object({
  description: z.string().trim().min(1),
  executedBy: z.string().trim(),
  executedAt: z.string().trim(),
});

const capaPlanSchema = z.object({
  actionType: z.enum(["CORRECTIVE", "PREVENTIVE"]),
  description: z.string().trim().min(1),
  plannedExecutionDate: z.string().trim(),
  responsible: z.string().trim(),
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

export function parseDeviationForm(formData: FormData) {
  const businessCode = text(formData, "businessCode");
  const departmentId = text(formData, "departmentId");
  const issueDate = text(formData, "issueDate");
  const whatHappened = text(formData, "whatHappened");
  const createdByText = text(formData, "createdByText");
  const modifiedByText = text(formData, "modifiedByText");
  const recordStatus = enumValue(status, text(formData, "status")) ?? "OPEN";

  const immediateActions = parseArray<ImmediateActionInput>(
    text(formData, "immediateActionsJson"),
    immediateActionSchema,
  );
  const capaPlans = parseArray<CapaPlanInput>(
    text(formData, "capaPlansJson"),
    capaPlanSchema,
  );

  const methods = formData
    .getAll("investigationMethods")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => ["BRAINSTORMING", "FIVE_WHYS", "FTA", "ISHIKAWA"].includes(value));

  const errors: string[] = [];
  if (!businessCode) errors.push("La codificación de la desviación es obligatoria.");
  if (!departmentId) errors.push("El departamento es obligatorio.");
  if (!issueDate) errors.push("La fecha de apertura es obligatoria.");
  if (!whatHappened) errors.push("La descripción objetiva de lo ocurrido es obligatoria.");
  if (!createdByText) errors.push("Debe indicarse quién cumplimenta el registro.");

  const investigation = text(formData, "investigation");
  const rootCause = text(formData, "rootCause");
  const deviationClassification = enumValue(classification, text(formData, "classification"));
  const conclusion = text(formData, "conclusion");
  const closedAt = text(formData, "closedAt");

  if (recordStatus === "CLOSED") {
    if (!investigation) errors.push("Para cerrar la desviación debe existir investigación.");
    if (!rootCause) errors.push("Para cerrar la desviación debe existir causa raíz.");
    if (!deviationClassification) errors.push("Para cerrar la desviación debe existir clasificación.");
    if (!conclusion) errors.push("Para cerrar la desviación debe existir conclusión/cierre.");
    if (!closedAt) errors.push("Para cerrar la desviación debe informarse la fecha de cierre.");
  }

  const capaRequiredRaw = text(formData, "capaRequired");
  const capaRequired = capaRequiredRaw === "true" ? true : capaRequiredRaw === "false" ? false : null;
  if (capaRequired === true && capaPlans.length === 0) {
    errors.push("Se ha indicado que procede CAPA, pero no se ha definido ninguna acción CAPA.");
  }

  return {
    errors,
    actor: modifiedByText ?? createdByText ?? "Usuario no informado",
    values: {
      businessCode,
      departmentId,
      issueDate,
      eventDateTime: text(formData, "eventDateTime"),
      detectedBy: text(formData, "detectedBy"),\n      eventShift: text(formData, "eventShift"),
      createdByText,\n      qaValidatedBy: text(formData, "qaValidatedBy"),\n      finalApprovedBy: text(formData, "finalApprovedBy"),
      materialProcessAffected: text(formData, "materialProcessAffected"),
      provenance: text(formData, "provenance"),
      affectedDocumentation: text(formData, "affectedDocumentation"),
      processEquipmentSystem: text(formData, "processEquipmentSystem"),
      finishedProductSystem: text(formData, "finishedProductSystem"),
      productLot: text(formData, "productLot"),
      lotSize: text(formData, "lotSize"),
      affectedQuantity: text(formData, "affectedQuantity"),
      client: text(formData, "client"),
      rawOrPackagingMaterial: text(formData, "rawOrPackagingMaterial"),
      materialLot: text(formData, "materialLot"),
      materialLotSize: text(formData, "materialLotSize"),
      materialAffectedQuantity: text(formData, "materialAffectedQuantity"),
      supplier: text(formData, "supplier"),
      supplierLot: text(formData, "supplierLot"),
      affectedEquipmentLine: text(formData, "affectedEquipmentLine"),
      otherOrigin: text(formData, "otherOrigin"),
      whatHappened,
      whoInvolved: text(formData, "whoInvolved"),
      whenHappened: text(formData, "whenHappened"),
      whereHappened: text(formData, "whereHappened"),
      howHappened: text(formData, "howHappened"),
      investigation,
      investigationConclusive: enumValue(triState, text(formData, "investigationConclusive")),
      investigationMethods: methods,
      rootCause,
      recurrentRootCause: enumValue(triState, text(formData, "recurrentRootCause")),
      recurrenceDetails: text(formData, "recurrenceDetails"),
      classification: deviationClassification,
      validationImpact: enumValue(triState, text(formData, "validationImpact")),
      registrationImpact: enumValue(triState, text(formData, "registrationImpact")),
      stabilityImpact: enumValue(triState, text(formData, "stabilityImpact")),
      otherProcessesImpact: enumValue(triState, text(formData, "otherProcessesImpact")),
      otherProcessesImpactDetails: text(formData, "otherProcessesImpactDetails"),
      affectsFinishedProduct: enumValue(triState, text(formData, "affectsFinishedProduct")),
      capaRequired,
      conclusion,
      disposition: text(formData, "disposition"),
      dispositionQuantity: text(formData, "dispositionQuantity"),
      dispositionComments: text(formData, "dispositionComments"),
      clientNotification: enumValue(triState, text(formData, "clientNotification")),
      closedAt,
      status: recordStatus,
      internalObservations: text(formData, "internalObservations"),
      signedDocumentAvailable:
        text(formData, "signedDocumentAvailable") === "true"
          ? true
          : text(formData, "signedDocumentAvailable") === "false"
            ? false
            : null,
      dataQualityStatus:
        enumValue(dataQuality, text(formData, "dataQualityStatus")) ?? "REVIEW_REQUIRED",
      immediateActions,
      capaPlans,
    },
  };
}
