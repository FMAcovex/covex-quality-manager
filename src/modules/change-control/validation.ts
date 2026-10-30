import { z } from "zod";
import { optionalUserId, rowUserIdSchema } from "@/lib/qms/responsible-user";
import type { ChangeTaskInput } from "@/modules/change-control/types";
import { cleanText } from "@/lib/forms/bullets";

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
const finalStatus = z.enum(["DRAFT", "OPEN", "CLOSED"]);

const taskSchema = z.object({
  id: z.string().optional(),
  departmentId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  responsible: z.string().trim().min(1),
  responsibleUserId: rowUserIdSchema,
  plannedDate: z.string().trim().min(1),
});

function text(formData: FormData, name: string) {
  const raw = formData.get(name);
  // D-126: quita las viñetas vacías; un texto sin contenido no cuenta como relleno.
  return typeof raw === "string" ? cleanText(raw) : null;
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

function parseTasks(raw: string | null) {
  if (!raw) return { tasks: [] as ChangeTaskInput[], hasIncompleteTask: false };
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return { tasks: [] as ChangeTaskInput[], hasIncompleteTask: false };
    const relevant = value.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return [candidate.departmentId, candidate.description, candidate.responsible, candidate.plannedDate]
        .some((field) => typeof field === "string" && field.trim());
    });
    const parsed = relevant.map((item) => taskSchema.safeParse(item));
    return {
      tasks: parsed
        .filter((item): item is z.SafeParseSuccess<z.output<typeof taskSchema>> => item.success)
        .map((item) => item.data),
      hasIncompleteTask: parsed.some((item) => !item.success),
    };
  } catch { /* Entrada mal formada: se trata como vacía o no válida. */
    return { tasks: [] as ChangeTaskInput[], hasIncompleteTask: true };
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
  const parsedTasks = parseTasks(text(formData, "tasksJson"));
  const tasks = parsedTasks.tasks;
  const decision = enumValue(requestDecision, text(formData, "requestDecision")) ?? "PENDING";
  const result = enumValue(dictamenResult, text(formData, "dictamenResult")) ?? "PENDING";
  const classValue = enumValue(classification, text(formData, "classification"));
  const recordStatus = enumValue(finalStatus, text(formData, "finalStatus")) ?? "DRAFT";

  const errors: string[] = [];

  if (recordStatus !== "DRAFT") {
    if (!departmentId) errors.push("El departamento/área solicitante es obligatorio.");
    if (!requestDate) errors.push("La fecha de solicitud es obligatoria.");
    if (!requesterName) errors.push("Debe identificarse el solicitante.");
    if (!text(formData, "requesterPosition")) errors.push("El puesto del solicitante es obligatorio.");
    if (!scopeValues.length) errors.push("Debe seleccionarse al menos un alcance.");
    if (!description) errors.push("La descripción del cambio es obligatoria.");
    if (!justification) errors.push("La justificación del cambio es obligatoria.");
    if (!text(formData, "providedDocuments")) errors.push("La relación de documentos aportados es obligatoria; indique No aplica cuando corresponda.");
    if (!text(formData, "evaluation")) errors.push("La evaluación del cambio es obligatoria.");
    if (!classValue) errors.push("La clasificación Mayor/Menor es obligatoria.");
    if (!text(formData, "plannedImplementationDate")) errors.push("La fecha prevista de implementación es obligatoria.");
    if (bool(formData, "committeeRequired") === null) errors.push("Debe responderse si se requiere Comité de cambios.");
    if (bool(formData, "clientNotificationRequired") === null) errors.push("Debe responderse si se requiere informar al cliente.");
    if (bool(formData, "authorityRequired") === null) errors.push("Debe responderse si interviene la autoridad sanitaria.");
    if (!enumValue(triState, text(formData, "pqrRequired"))) errors.push("Debe responderse la implicación en PQR.");
    if (!enumValue(triState, text(formData, "stabilityRequired"))) errors.push("Debe responderse la implicación en estabilidad.");
    if (!enumValue(triState, text(formData, "additionalAnalysisRequired"))) errors.push("Debe responderse si se requieren análisis adicionales.");
    if (!enumValue(triState, text(formData, "additionalValidationRequired"))) errors.push("Debe responderse si se requiere validación adicional.");
    if (bool(formData, "otherImplicationRequired") === null) errors.push("Debe responderse si existen otras implicaciones.");
    if (scopeValues.includes("OTHER") && !text(formData, "otherScope")) {
      errors.push("Debe especificarse el alcance cuando se selecciona Otros.");
    }
    if (bool(formData, "committeeRequired") && !text(formData, "committeeDetails")) errors.push("Debe justificarse la intervención del Comité de cambios.");
    if (bool(formData, "clientNotificationRequired") && !text(formData, "clientNotificationDetails")) errors.push("Debe detallarse la información al cliente.");
    if (bool(formData, "authorityRequired") && !text(formData, "authorityDetails")) errors.push("Debe detallarse la intervención de la autoridad sanitaria.");
    if (enumValue(triState, text(formData, "pqrRequired")) === "YES" && (!text(formData, "pqrProducts") || !text(formData, "pqrPeriod"))) errors.push("Cuando el cambio se refleja en PQR deben indicarse productos y periodo.");
    if (enumValue(triState, text(formData, "additionalAnalysisRequired")) === "YES" && !text(formData, "additionalAnalysisDetails")) errors.push("Deben especificarse los análisis adicionales.");
    if (enumValue(triState, text(formData, "additionalValidationRequired")) === "YES" && !text(formData, "additionalValidationDetails")) errors.push("Debe detallarse la validación adicional.");
    if (bool(formData, "otherImplicationRequired") && !text(formData, "otherImplicationDetails")) errors.push("Deben especificarse las otras implicaciones.");
    if (parsedTasks.hasIncompleteTask) errors.push("Cada acción del Plan de ejecución debe indicar departamento, acción, responsable y fecha prevista.");
  }
  if (recordStatus !== "DRAFT" && decision !== "PENDING") {
    if (!text(formData, "requestDecisionResponsible")) errors.push("El responsable de dictamen es obligatorio cuando la solicitud se acepta o deniega.");
    if (!text(formData, "requestDecisionRole")) errors.push("El cargo/función del responsable de dictamen es obligatorio.");
    if (!text(formData, "requestDecisionDate")) errors.push("Una solicitud aceptada o denegada debe tener fecha de decisión.");
  }
  if (recordStatus !== "DRAFT" && result !== "PENDING") {
    if (!text(formData, "dictamenDate")) errors.push("Un resultado de dictamen debe tener fecha.");
    if (!text(formData, "dictamenObservations")) errors.push("Las observaciones del resultado del dictamen son obligatorias.");
  }
  if (recordStatus !== "DRAFT" && result === "APPROVED") {
    if (!text(formData, "nextFollowupDate")) errors.push("Debe indicarse la fecha del próximo seguimiento.");
    if (!text(formData, "followupResponsible")) errors.push("Debe indicarse el responsable de seguimiento.");
    if (!tasks.length) errors.push("Un cambio aprobado debe tener al menos una acción en el plan de ejecución.");
  }

  const fieldIssues: Record<string, string[]> = {};
  const bindIssue = (field: string, message: string) => {
    if (errors.includes(message)) fieldIssues[field] = [...(fieldIssues[field] ?? []), message];
  };
  [
    ["departmentId", "El departamento/área solicitante es obligatorio."],
    ["requestDate", "La fecha de solicitud es obligatoria."],
    ["requesterName", "Debe identificarse el solicitante."],
    ["requesterPosition", "El puesto del solicitante es obligatorio."],
    ["scope", "Debe seleccionarse al menos un alcance."],
    ["description", "La descripción del cambio es obligatoria."],
    ["justification", "La justificación del cambio es obligatoria."],
    ["providedDocuments", "La relación de documentos aportados es obligatoria; indique No aplica cuando corresponda."],
    ["evaluation", "La evaluación del cambio es obligatoria."],
    ["classification", "La clasificación Mayor/Menor es obligatoria."],
    ["plannedImplementationDate", "La fecha prevista de implementación es obligatoria."],
    ["committeeRequired", "Debe responderse si se requiere Comité de cambios."],
    ["clientNotificationRequired", "Debe responderse si se requiere informar al cliente."],
    ["authorityRequired", "Debe responderse si interviene la autoridad sanitaria."],
    ["pqrRequired", "Debe responderse la implicación en PQR."],
    ["stabilityRequired", "Debe responderse la implicación en estabilidad."],
    ["additionalAnalysisRequired", "Debe responderse si se requieren análisis adicionales."],
    ["additionalValidationRequired", "Debe responderse si se requiere validación adicional."],
    ["otherImplicationRequired", "Debe responderse si existen otras implicaciones."],
    ["otherScope", "Debe especificarse el alcance cuando se selecciona Otros."],
    ["committeeDetails", "Debe justificarse la intervención del Comité de cambios."],
    ["clientNotificationDetails", "Debe detallarse la información al cliente."],
    ["authorityDetails", "Debe detallarse la intervención de la autoridad sanitaria."],
    ["pqrProducts", "Cuando el cambio se refleja en PQR deben indicarse productos y periodo."],
    ["pqrPeriod", "Cuando el cambio se refleja en PQR deben indicarse productos y periodo."],
    ["additionalAnalysisDetails", "Deben especificarse los análisis adicionales."],
    ["additionalValidationDetails", "Debe detallarse la validación adicional."],
    ["otherImplicationDetails", "Deben especificarse las otras implicaciones."],
    ["tasks", "Cada acción del Plan de ejecución debe indicar departamento, acción, responsable y fecha prevista."],
    ["requestDecisionResponsible", "El responsable de dictamen es obligatorio cuando la solicitud se acepta o deniega."],
    ["requestDecisionRole", "El cargo/función del responsable de dictamen es obligatorio."],
    ["requestDecisionDate", "Una solicitud aceptada o denegada debe tener fecha de decisión."],
    ["dictamenDate", "Un resultado de dictamen debe tener fecha."],
    ["dictamenObservations", "Las observaciones del resultado del dictamen son obligatorias."],
    ["nextFollowupDate", "Debe indicarse la fecha del próximo seguimiento."],
    ["followupResponsible", "Debe indicarse el responsable de seguimiento."],
    ["tasks", "Un cambio aprobado debe tener al menos una acción en el plan de ejecución."],
  ].forEach(([field, message]) => bindIssue(field, message));

  return {
    errors,
    fieldIssues,
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
      requestDecisionResponsibleUserId: optionalUserId(formData.get("requestDecisionResponsibleUserId")) ?? null,
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
      followupResponsibleUserId: optionalUserId(formData.get("followupResponsibleUserId")) ?? null,
      nextFollowupDate: text(formData, "nextFollowupDate"),
      dictamenObservations: text(formData, "dictamenObservations"),
      internalObservations: text(formData, "internalObservations"),
      signedDocumentAvailable: bool(formData, "signedDocumentAvailable"),
      dataQualityStatus:
        enumValue(dataQuality, text(formData, "dataQualityStatus")) ?? "REVIEW_REQUIRED",
      finalStatus: recordStatus,
      tasks,
      changeReason: text(formData, "changeReason"),
    },
  };
}
