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

function validDateTime(value: string | null) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export function parseDeviationForm(formData: FormData) {
  const businessCode = text(formData, "businessCode");
  const departmentId = text(formData, "departmentId");
  const issueDate = text(formData, "issueDate");
  const eventDateTime = text(formData, "eventDateTime");
  const whatHappened = text(formData, "whatHappened");
  const whoInvolved = text(formData, "whoInvolved");
  const whenHappened = text(formData, "whenHappened");
  const whereHappened = text(formData, "whereHappened");
  const howHappened = text(formData, "howHappened");
  const detectedBy = text(formData, "detectedBy");
  const materialProcessAffected = text(formData, "materialProcessAffected");
  const createdByText = text(formData, "createdByText");
  const modifiedByText = text(formData, "modifiedByText");
  const statusRaw = text(formData, "status");
  const recordStatus = enumValue(status, statusRaw) ?? "OPEN";
  const dataQualityRaw = text(formData, "dataQualityStatus");
  const dataQualityStatus = enumValue(dataQuality, dataQualityRaw) ?? "REVIEW_REQUIRED";

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
  const fieldIssues: Record<string, string[]> = {};
  const addIssue = (field: string, message: string) => {
    errors.push(message);
    fieldIssues[field] = [...(fieldIssues[field] ?? []), message];
  };

  if (!businessCode) addIssue("businessCode", "La codificación de la desviación es obligatoria.");
  if (!departmentId) addIssue("departmentId", "El departamento es obligatorio.");
  if (!issueDate) addIssue("issueDate", "La fecha de apertura es obligatoria.");
  else if (!validDate(issueDate)) addIssue("issueDate", "La fecha de apertura no tiene un formato válido.");
  if (eventDateTime && !validDateTime(eventDateTime)) {
    addIssue("eventDateTime", "La fecha/hora del evento no tiene un formato válido.");
  }
  if (!eventDateTime) addIssue("eventDateTime", "La fecha/hora del evento es obligatoria.");
  if (!detectedBy) addIssue("detectedBy", "Debe indicarse quién detectó la desviación.");
  if (!materialProcessAffected) addIssue("materialProcessAffected", "La breve descripción del proceso/equipo/sistema afectado es obligatoria.");
  if (!whatHappened) addIssue("whatHappened", "La descripción objetiva de lo ocurrido es obligatoria.");
  if (!whoInvolved) addIssue("whoInvolved", "Debe indicarse quién estuvo implicado y cuál fue su papel.");
  if (!whenHappened) addIssue("whenHappened", "Debe indicarse cuándo ocurrió.");
  if (!whereHappened) addIssue("whereHappened", "Debe indicarse dónde ocurrió.");
  if (!howHappened) addIssue("howHappened", "Debe indicarse cómo se detectó o cómo ocurrió.");
  if (!createdByText) addIssue("createdByText", "Debe indicarse quién cumplimenta el registro.");

  const affectedDocumentation = text(formData, "affectedDocumentation");
  const investigation = text(formData, "investigation");
  const investigationConclusive = enumValue(triState, text(formData, "investigationConclusive"));
  const rootCause = text(formData, "rootCause");
  const recurrentRootCause = enumValue(triState, text(formData, "recurrentRootCause"));
  const recurrenceDetails = text(formData, "recurrenceDetails");
  const deviationClassification = enumValue(classification, text(formData, "classification"));
  const validationImpact = enumValue(triState, text(formData, "validationImpact"));
  const registrationImpact = enumValue(triState, text(formData, "registrationImpact"));
  const stabilityImpact = enumValue(triState, text(formData, "stabilityImpact"));
  const otherProcessesImpact = enumValue(triState, text(formData, "otherProcessesImpact"));
  const otherProcessesImpactDetails = text(formData, "otherProcessesImpactDetails");
  const affectsFinishedProduct = enumValue(triState, text(formData, "affectsFinishedProduct"));
  const conclusion = text(formData, "conclusion");
  const disposition = text(formData, "disposition");
  const dispositionQuantity = text(formData, "dispositionQuantity");
  const dispositionComments = text(formData, "dispositionComments");
  const clientNotification = enumValue(triState, text(formData, "clientNotification"));
  const closedAt = text(formData, "closedAt");

  if (!affectedDocumentation) addIssue("affectedDocumentation", "La documentación afectada es obligatoria.");
  if (!investigation) addIssue("investigation", "La investigación y sus conclusiones son obligatorias.");
  if (!investigationConclusive) addIssue("investigationConclusive", "Debe indicarse si la investigación es concluyente o no concluyente.");
  if (methods.length === 0) addIssue("investigationMethods", "Debe seleccionarse al menos una metodología de análisis.");
  if (!rootCause) addIssue("rootCause", "La causa raíz es obligatoria.");
  if (!recurrentRootCause) addIssue("recurrentRootCause", "Debe indicarse si la causa raíz es recurrente.");
  if (!recurrenceDetails) addIssue("recurrenceDetails", "Los antecedentes o el detalle de recurrencia son obligatorios.");
  if (!deviationClassification) addIssue("classification", "La clasificación de la desviación es obligatoria.");
  if (!validationImpact) addIssue("validationImpact", "Debe evaluarse el impacto sobre validación.");
  if (!registrationImpact) addIssue("registrationImpact", "Debe evaluarse el impacto sobre registro.");
  if (!stabilityImpact) addIssue("stabilityImpact", "Debe evaluarse el impacto sobre estabilidad.");
  if (!otherProcessesImpact) addIssue("otherProcessesImpact", "Debe evaluarse el impacto sobre otros procesos o productos.");
  if (!affectsFinishedProduct) addIssue("affectsFinishedProduct", "Debe indicarse si afecta a producto terminado.");
  if (!otherProcessesImpactDetails) addIssue("otherProcessesImpactDetails", "La justificación/detalle del impacto es obligatoria.");
  if (!conclusion) addIssue("conclusion", "La conclusión/cierre es obligatoria.");
  if (!disposition) addIssue("disposition", "La disposición final es obligatoria.");
  if (!dispositionQuantity) addIssue("dispositionQuantity", "La cantidad es obligatoria.");
  if (!clientNotification) addIssue("clientNotification", "Debe indicarse si procede notificación al cliente.");
  if (!dispositionComments) addIssue("dispositionComments", "Los comentarios de disposición son obligatorios.");
  if (!statusRaw) addIssue("status", "El estado del expediente es obligatorio.");
  if (!dataQualityRaw) addIssue("dataQualityStatus", "El control de estado es obligatorio.");

  if (closedAt && !validDate(closedAt)) {
    addIssue("closedAt", "La fecha de cierre no tiene un formato válido.");
  }

  immediateActions.forEach((action, index) => {
    if (action.executedAt && !validDate(action.executedAt)) {
      addIssue(
        "immediateActionsJson",
        `La fecha de la acción inmediata ${index + 1} no tiene un formato válido.`,
      );
    }
  });
  capaPlans.forEach((plan, index) => {
    if (plan.plannedExecutionDate && !validDate(plan.plannedExecutionDate)) {
      addIssue(
        "capaPlansJson",
        `La fecha prevista de la propuesta CAPA ${index + 1} no tiene un formato válido.`,
      );
    }
  });

  if (recordStatus === "CLOSED") {
    if (!investigation) addIssue("investigation", "Para cerrar la desviación debe existir investigación.");
    if (!rootCause) addIssue("rootCause", "Para cerrar la desviación debe existir causa raíz.");
    if (!deviationClassification) addIssue("classification", "Para cerrar la desviación debe existir clasificación.");
    if (!conclusion) addIssue("conclusion", "Para cerrar la desviación debe existir conclusión/cierre.");
    if (!closedAt) addIssue("closedAt", "Para cerrar la desviación debe informarse la fecha de cierre.");
  }

  const capaRequiredRaw = text(formData, "capaRequired");
  const capaRequired =
    capaRequiredRaw === "true" ? true : capaRequiredRaw === "false" ? false : null;
  if (capaRequired === null) {
    addIssue("capaRequired", "Debe indicarse si procede abrir CAPA.");
  }
  return {
    errors,
    fieldIssues,
    actor: modifiedByText ?? createdByText ?? "Usuario no informado",
    values: {
      businessCode,
      departmentId,
      issueDate,
      eventDateTime,
      detectedBy,
      createdByText,
      materialProcessAffected,
      provenance: text(formData, "provenance"),
      affectedDocumentation,
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
      whoInvolved,
      whenHappened,
      whereHappened,
      howHappened,
      investigation,
      investigationConclusive,
      investigationMethods: methods,
      rootCause,
      recurrentRootCause,
      recurrenceDetails,
      classification: deviationClassification,
      validationImpact,
      registrationImpact,
      stabilityImpact,
      otherProcessesImpact,
      otherProcessesImpactDetails,
      affectsFinishedProduct,
      capaRequired,
      conclusion,
      disposition,
      dispositionQuantity,
      dispositionComments,
      clientNotification,
      closedAt,
      status: recordStatus,
      internalObservations: text(formData, "internalObservations"),
      signedDocumentAvailable:
        text(formData, "signedDocumentAvailable") === "true"
          ? true
          : text(formData, "signedDocumentAvailable") === "false"
            ? false
            : null,
      dataQualityStatus,
      immediateActions,
      capaPlans,
    },
  };
}
