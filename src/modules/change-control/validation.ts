import { z } from "zod";
import type { ChangeTaskInput } from "@/modules/change-control/types";
import { requestedWorkflowStatus } from "@/lib/forms/draft-workflow";

const scope = z.enum([
  "INSTALLATIONS",
  "EQUIPMENT",
  "PROCESS",
  "MATERIAL",
  "SUPPLIER",
  "DOCUMENTATION",
  "OTHER",
]);
const requestDecision = z.enum(["PENDING", "ACCEPTED", "DENIED"]);
const classification = z.enum(["MAJOR", "MINOR"]);
const dictamenResult = z.enum(["PENDING", "APPROVED", "REJECTED"]);
const triState = z.enum(["YES", "NO", "NA"]);
const dataQuality = z.enum(["COMPLETE", "INCOMPLETE", "REVIEW_REQUIRED"]);
const finalStatusSchema = z.enum(["DRAFT", "OPEN", "CLOSED"]);

const taskSchema = z.object({
  id: z.string().optional(),
  departmentId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  responsible: z.string().trim(),
  plannedDate: z.string().trim(),
});

function text(formData: FormData, name: string) {
  const raw = formData.get(name);
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value || null;
}

function bool(formData: FormData, name: string) {
  const value = text(formData, name);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function enumValue<T extends z.ZodTypeAny>(schema: T, value: string | null) {
  if (!value) return null;
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

function parseTasks(raw: string | null): ChangeTaskInput[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => taskSchema.safeParse(item))
      .filter((item): item is z.SafeParseSuccess<ChangeTaskInput> => item.success)
      .map((item) => item.data);
  } catch {
    return [];
  }
}

export function parseChangeControlForm(formData: FormData) {
  const businessCode = text(formData, "businessCode");
  const departmentId = text(formData, "departmentId");
  const requestDate = text(formData, "requestDate");
  const requesterName = text(formData, "requesterName");
  const description = text(formData, "description");
  const justification = text(formData, "justification");
  const scopeValues = formData
    .getAll("scope")
    .map(String)
    .map((value) => enumValue(scope, value))
    .filter((value): value is z.infer<typeof scope> => Boolean(value));
  const tasks = parseTasks(text(formData, "tasksJson"));
  const decision = enumValue(requestDecision, text(formData, "requestDecision")) ?? "PENDING";
  const result = enumValue(dictamenResult, text(formData, "dictamenResult")) ?? "PENDING";
  const classValue = enumValue(classification, text(formData, "classification"));
  const storedFinalStatus = enumValue(finalStatusSchema, text(formData, "finalStatus")) ?? "OPEN";
  const finalStatus = requestedWorkflowStatus(formData, storedFinalStatus);
  const draftMode = finalStatus === "DRAFT";

  const errors: string[] = [];
  const required = (condition: boolean, message: string) => {
    if (condition && !draftMode) errors.push(message);
  };
  required(!businessCode, "La codificación del Control de Cambio es obligatoria.");
  required(!departmentId, "El departamento/área solicitante es obligatorio.");
  required(!requestDate, "La fecha de solicitud es obligatoria.");
  required(!requesterName, "Debe identificarse el solicitante.");
  required(!scopeValues.length, "Debe seleccionarse al menos un alcance.");
  required(!description, "La descripción del cambio es obligatoria.");
  required(!justification, "La justificación del cambio es obligatoria.");
  if (!draftMode && scopeValues.includes("OTHER") && !text(formData, "otherScope")) {
    errors.push("Debe especificarse el alcance cuando se selecciona Otros.");
  }
  if (!draftMode && decision === "ACCEPTED" && !text(formData, "requestDecisionDate")) {
    errors.push("Una solicitud aceptada debe tener fecha de aceptación.");
  }
  if (!draftMode && result === "APPROVED") {
    if (!classValue) errors.push("Un dictamen aprobado debe clasificar el cambio como Mayor o Menor.");
    if (!text(formData, "dictamenDate")) errors.push("Un dictamen aprobado debe tener fecha de aprobación.");
    if (!text(formData, "followupResponsible")) errors.push("Debe indicarse el responsable de seguimiento.");
    if (!tasks.length) errors.push("Un cambio aprobado debe tener al menos una acción en el plan de ejecución.");
  }

  return {
    errors,
    actor: text(formData, "modifiedByText") ?? requesterName ?? "Usuario no informado",
    values: {
      businessCode,
      departmentId,
      requestDate,
      requesterName,
      requesterPosition: text(formData, "requesterPosition"),
      scope: scopeValues,
      otherScope: text(formData, "otherScope"),
      description,
      justification,
      providedDocuments: text(formData, "providedDocuments"),
      requestDecision: decision,
      requestDecisionResponsible: text(formData, "requestDecisionResponsible"),
      requestDecisionRole: text(formData, "requestDecisionRole"),
      requestDecisionDate: text(formData, "requestDecisionDate"),
      evaluation: text(formData, "evaluation"),
      classification: classValue,
      plannedImplementationDate: text(formData, "plannedImplementationDate"),
      committeeRequired: bool(formData, "committeeRequired"),
      committeeDetails: text(formData, "committeeDetails"),
      clientNotificationRequired: bool(formData, "clientNotificationRequired"),
      clientNotificationDetails: text(formData, "clientNotificationDetails"),
      authorityRequired: bool(formData, "authorityRequired"),
      authorityDetails: text(formData, "authorityDetails"),
      pqrRequired: enumValue(triState, text(formData, "pqrRequired")),
      pqrProducts: text(formData, "pqrProducts"),
      pqrPeriod: text(formData, "pqrPeriod"),
      stabilityRequired: enumValue(triState, text(formData, "stabilityRequired")),
      stabilityAccelerated: formData.get("stabilityAccelerated") === "on",
      stabilityOngoing: formData.get("stabilityOngoing") === "on",
      additionalAnalysisRequired: enumValue(triState, text(formData, "additionalAnalysisRequired")),
      additionalAnalysisDetails: text(formData, "additionalAnalysisDetails"),
      additionalValidationRequired: enumValue(triState, text(formData, "additionalValidationRequired")),
      additionalValidationDetails: text(formData, "additionalValidationDetails"),
      otherImplicationRequired: bool(formData, "otherImplicationRequired"),
      otherImplicationDetails: text(formData, "otherImplicationDetails"),
      dictamenResult: result,
      dictamenDate: text(formData, "dictamenDate"),
      followupResponsible: text(formData, "followupResponsible"),
      dictamenObservations: text(formData, "dictamenObservations"),
      approvalNames: text(formData, "approvalNames"),
      internalObservations: text(formData, "internalObservations"),
      signedDocumentAvailable: bool(formData, "signedDocumentAvailable"),
      dataQualityStatus:
        enumValue(dataQuality, text(formData, "dataQualityStatus")) ?? "REVIEW_REQUIRED",
      finalStatus,
      tasks,
      changeReason: text(formData, "changeReason"),
    },
  };
}
