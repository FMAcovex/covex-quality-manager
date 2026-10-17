import { z } from "zod";
import { oosClosingResults, oosEvaluationKeys, type OosPhaseIEvaluation } from "./domain";

const areaSchema = z.enum(["API", "MD"]);
const statusSchema = z.enum(["DRAFT", "OPEN", "CLOSED"]);
const materialKindSchema = z.enum(["FINISHED_PRODUCT", "RAW_OR_PACKAGING_MATERIAL"]);
const dispositionSchema = z.enum(["LAB_ERROR", "FULL_SCALE"]);
const verdictSchema = z.enum(["APPROVED", "REJECTED", "OTHER"]);
const resultSchema = z.enum(["INVALIDATED", "CONFIRMED", "INCONCLUSIVE"]);

function text(fd: FormData, name: string) {
  const value = fd.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function option<T extends z.ZodTypeAny>(schema: T, value: string | null): z.infer<T> | null {
  if (!value) return null;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function validOosDate(value: string | null) {
  return !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}

const dateFields = ["issueDate", "oosDate", "phaseIIssuedAt", "phaseIApprovedAt", "phaseIIIssueDate", "phaseIIIssuedAt", "closedAt"] as const;
const dateLabels: Record<(typeof dateFields)[number], string> = {
  issueDate: "fecha de emisión",
  oosDate: "fecha del OOS",
  phaseIIssuedAt: "fecha de emisión de la Fase I",
  phaseIApprovedAt: "fecha de aprobación de la Fase I",
  phaseIIIssueDate: "fecha de emisión de la Fase II",
  phaseIIIssuedAt: "fecha de firma de la Fase II",
  closedAt: "fecha de cierre",
};

const phaseIIFields = [
  "phaseIIIssueDate",
  "phaseIIProductionReview",
  "phaseIIRetesting",
  "phaseIIResampling",
  "phaseIIConclusion",
  "phaseIIVerdict",
  "phaseIIVerdictQuantity",
  "phaseIIDestroyQuantity",
  "phaseIIReturnQuantity",
  "phaseIIVerdictOther",
  "phaseIIIssuedBy",
  "phaseIIIssuedAt",
  "phaseIIAffectedDepartments",
] as const;

function evaluation(fd: FormData): OosPhaseIEvaluation {
  const result: OosPhaseIEvaluation = {};
  for (const key of oosEvaluationKeys) {
    const value = text(fd, `evaluation.${key}`);
    if (value) result[key] = value;
  }
  return result;
}

export function parseOosForm(fd: FormData) {
  const errors: string[] = [];
  const status = option(statusSchema, text(fd, "status")) ?? "DRAFT";
  const area = option(areaSchema, text(fd, "area"));
  const phaseIDisposition = option(dispositionSchema, text(fd, "phaseIDisposition"));
  const phaseIVerdict = option(verdictSchema, text(fd, "phaseIVerdict"));
  const phaseIIVerdict = option(verdictSchema, text(fd, "phaseIIVerdict"));
  const investigationResult = option(resultSchema, text(fd, "investigationResult"));
  const oosTime = text(fd, "oosTime");
  const required = (name: string, message: string) => {
    if (!text(fd, name)) errors.push(message);
  };

  for (const name of dateFields) {
    if (!validOosDate(text(fd, name))) errors.push(`La ${dateLabels[name]} no es válida.`);
  }
  if (oosTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(oosTime)) errors.push("La hora del OOS debe tener el formato HH:MM.");
  if (text(fd, "phaseIVerdict") && !phaseIVerdict) errors.push("El dictamen de la Fase I no es válido.");
  if (text(fd, "phaseIIVerdict") && !phaseIIVerdict) errors.push("El dictamen de la Fase II no es válido.");
  if (phaseIVerdict === "OTHER") required("phaseIVerdictOther", "Indica el dictamen «Otros» de la Fase I.");
  if (phaseIIVerdict === "OTHER") required("phaseIIVerdictOther", "Indica el dictamen «Otros» de la Fase II.");

  if (phaseIDisposition !== "FULL_SCALE" && phaseIIFields.some((name) => text(fd, name))) {
    errors.push("La Fase II solo se cumplimenta cuando la disposición de la Fase I es «Investigación a gran escala».");
  }
  if (investigationResult && !oosClosingResults(phaseIDisposition).includes(investigationResult)) {
    errors.push(phaseIDisposition
      ? "El resultado de la investigación no corresponde a la disposición de la Fase I."
      : "Indica la disposición de la Fase I antes del resultado de la investigación.");
  }

  if (status !== "DRAFT") {
    if (!area) errors.push("El área (API o MD) es obligatoria para abrir el OOS.");
    required("departmentId", "El departamento es obligatorio para abrir el OOS.");
    required("issueDate", "La fecha de emisión es obligatoria para abrir el OOS.");
    if (!option(materialKindSchema, text(fd, "materialKind"))) errors.push("Indica si el material afectado es producto final o materia prima / material de acondicionamiento.");
    required("materialName", "El material afectado es obligatorio.");
    required("lotNumber", "El n.º de lote es obligatorio.");
    required("detectionDescription", "La descripción de la detección del OOS es obligatoria.");
  }

  if (status === "CLOSED") {
    required("closedAt", "Un OOS cerrado requiere fecha de cierre.");
    if (!phaseIDisposition) errors.push("Un OOS cerrado requiere la disposición final de la Fase I.");
    if (!investigationResult) errors.push("Un OOS cerrado requiere el resultado de la investigación.");
    if (phaseIDisposition === "LAB_ERROR") {
      required("phaseIConclusion", "El cierre en Fase I requiere las conclusiones del fuera de especificación.");
      if (!phaseIVerdict) errors.push("El cierre en Fase I requiere el dictamen.");
      required("phaseIIssuedBy", "El cierre en Fase I requiere quién emite el informe (Control de Calidad).");
      required("phaseIIssuedAt", "El cierre en Fase I requiere la fecha de emisión del informe.");
    }
    if (phaseIDisposition === "FULL_SCALE") {
      required("phaseIIConclusion", "El cierre en Fase II requiere la conclusión de la investigación.");
      if (!phaseIIVerdict) errors.push("El cierre en Fase II requiere el dictamen.");
      required("phaseIIIssuedBy", "El cierre en Fase II requiere quién emite el informe (Garantía de Calidad).");
      required("phaseIIIssuedAt", "El cierre en Fase II requiere la fecha de emisión del informe.");
    }
  }

  return {
    errors,
    actor: text(fd, "modifiedByText") ?? text(fd, "createdByText") ?? "Usuario no informado",
    values: {
      businessCode: text(fd, "businessCode"),
      status,
      area,
      departmentId: text(fd, "departmentId"),
      createdByText: text(fd, "createdByText"),
      issueDate: text(fd, "issueDate"),
      materialKind: option(materialKindSchema, text(fd, "materialKind")),
      materialName: text(fd, "materialName"),
      lotNumber: text(fd, "lotNumber"),
      batchSize: text(fd, "batchSize"),
      affectedQuantity: text(fd, "affectedQuantity"),
      supplier: text(fd, "supplier"),
      supplierLot: text(fd, "supplierLot"),
      process: text(fd, "process"),
      oosDate: text(fd, "oosDate"),
      oosTime,
      detectedBy: text(fd, "detectedBy"),
      shift: text(fd, "shift"),
      detectionDescription: text(fd, "detectionDescription"),
      phaseIEvaluation: evaluation(fd),
      phaseIInvestigation: text(fd, "phaseIInvestigation"),
      phaseIConclusion: text(fd, "phaseIConclusion"),
      phaseIDisposition,
      phaseIVerdict,
      phaseIVerdictQuantity: text(fd, "phaseIVerdictQuantity"),
      phaseIDestroyQuantity: text(fd, "phaseIDestroyQuantity"),
      phaseIReturnQuantity: text(fd, "phaseIReturnQuantity"),
      phaseIVerdictOther: text(fd, "phaseIVerdictOther"),
      phaseIIssuedBy: text(fd, "phaseIIssuedBy"),
      phaseIIssuedAt: text(fd, "phaseIIssuedAt"),
      phaseIApprovedBy: text(fd, "phaseIApprovedBy"),
      phaseIApprovedAt: text(fd, "phaseIApprovedAt"),
      phaseIIIssueDate: text(fd, "phaseIIIssueDate"),
      phaseIIProductionReview: text(fd, "phaseIIProductionReview"),
      phaseIIRetesting: text(fd, "phaseIIRetesting"),
      phaseIIResampling: text(fd, "phaseIIResampling"),
      phaseIIConclusion: text(fd, "phaseIIConclusion"),
      phaseIIVerdict,
      phaseIIVerdictQuantity: text(fd, "phaseIIVerdictQuantity"),
      phaseIIDestroyQuantity: text(fd, "phaseIIDestroyQuantity"),
      phaseIIReturnQuantity: text(fd, "phaseIIReturnQuantity"),
      phaseIIVerdictOther: text(fd, "phaseIIVerdictOther"),
      phaseIIIssuedBy: text(fd, "phaseIIIssuedBy"),
      phaseIIIssuedAt: text(fd, "phaseIIIssuedAt"),
      phaseIIAffectedDepartments: text(fd, "phaseIIAffectedDepartments"),
      investigationResult,
      closedAt: status === "CLOSED" ? text(fd, "closedAt") : null,
      internalObservations: text(fd, "internalObservations"),
      changeReason: text(fd, "changeReason"),
    },
  };
}

export type OosFormValues = ReturnType<typeof parseOosForm>["values"];
