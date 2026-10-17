import type {
  OosArea,
  OosInvestigationResult,
  OosMaterialKind,
  OosPhaseIDisposition,
  OosStatus,
  OosVerdict,
} from "@prisma/client";

// PNT GC-10/014/04 «Resultados fuera de especificación» (D-088, docs/OOS_DESIGN.md).

export const oosAreaLabels: Record<OosArea, string> = {
  API: "API · principios activos",
  MD: "MD · medicamento y complemento alimenticio",
};

export const oosStatusLabels: Record<OosStatus, string> = {
  DRAFT: "Borrador",
  OPEN: "Abierto",
  CLOSED: "Cerrado",
};

export const oosMaterialKindLabels: Record<OosMaterialKind, string> = {
  FINISHED_PRODUCT: "Producto final (API / medicamento)",
  RAW_OR_PACKAGING_MATERIAL: "Materia prima / material de acondicionamiento",
};

export const oosPhaseIDispositionLabels: Record<OosPhaseIDisposition, string> = {
  LAB_ERROR: "Investigación concluyente (error de laboratorio)",
  FULL_SCALE: "Investigación a gran escala",
};

export const oosVerdictLabels: Record<OosVerdict, string> = {
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  OTHER: "Otros",
};

/** Resultado de la investigación según §5, «Conclusiones de la investigación». */
export const oosInvestigationResultLabels: Record<OosInvestigationResult, string> = {
  INVALIDATED: "Invalidado (error de laboratorio)",
  CONFIRMED: "Confirmado",
  INCONCLUSIVE: "No concluyente",
};

/** Evaluación del fuera de especificación, Anexo III (página 2), en el orden del anexo. */
export const oosPhaseIEvaluationGroups = [
  {
    key: "ANALYST",
    label: "Analista",
    items: [
      { key: "analystTraining", label: "Posee los conocimientos y la formación adecuada" },
      { key: "methodCorrect", label: "El método de análisis es correcto" },
      { key: "analystDialogue", label: "El diálogo con el analista confirma que no ha ocurrido nada anormal durante el análisis" },
      { key: "rawDataCorrect", label: "Los datos obtenidos por el analista son correctos (cromatogramas, espectros, etc.). Adjuntar" },
      { key: "calculationsCorrect", label: "Los cálculos utilizados son adecuados y correctos" },
    ],
  },
  {
    key: "SAMPLE",
    label: "Muestra",
    items: [
      { key: "samplingCorrect", label: "El muestreo realizado para la muestra a analizar es correcto" },
      { key: "sampleStorageCorrect", label: "La conservación de la muestra es correcta" },
      { key: "sampleUsedCorrect", label: "La muestra utilizada en el análisis es la correcta" },
      { key: "sampleQuantityCorrect", label: "La cantidad de muestra utilizada en el análisis es la establecida en el protocolo de análisis" },
    ],
  },
  {
    key: "EQUIPMENT",
    label: "Equipos",
    items: [
      { key: "equipmentOperation", label: "El funcionamiento del equipo es correcto" },
      { key: "equipmentVerified", label: "El equipo fue correctamente verificado" },
      { key: "equipmentCalibrated", label: "El equipo está dentro de su periodo de calibración" },
      { key: "equipmentProgram", label: "El programa del equipo para el análisis es correcto" },
    ],
  },
  {
    key: "REAGENTS",
    label: "Patrones / reactivos / disolventes / disoluciones",
    items: [
      { key: "reagentsCorrect", label: "Los patrones de referencia, reactivos, disolventes y disoluciones utilizados son correctos" },
      { key: "reagentsPreparation", label: "Los patrones de referencia, reactivos, disolventes y disoluciones utilizados estaban conformes en su preparación" },
      { key: "reagentsExpiry", label: "La caducidad de los patrones de referencia, reactivos, disolventes y disoluciones utilizados es correcta" },
      { key: "reagentsQuantity", label: "La cantidad de los patrones de referencia, reactivos, disolventes y disoluciones utilizados es correcta" },
      { key: "reagentsStorage", label: "La conservación de los patrones de referencia, reactivos, disolventes y disoluciones utilizados es correcta" },
    ],
  },
  {
    key: "MICROBIOLOGY",
    label: "Microbiología",
    items: [
      { key: "microEnvironmentWater", label: "Verificar si el control ambiental y de agua ha sido correcto" },
      { key: "microGrowthPromotion", label: "El test de promoción de crecimiento del medio de cultivo es correcto" },
      { key: "microNegativeControl", label: "El resultado del control negativo es correcto" },
    ],
  },
] as const;

export type OosEvaluationKey = (typeof oosPhaseIEvaluationGroups)[number]["items"][number]["key"];

export const oosEvaluationKeys: readonly OosEvaluationKey[] = oosPhaseIEvaluationGroups.flatMap(
  (group) => group.items.map((item) => item.key),
);

/** El anexo deja la columna «Resultado» en blanco: texto libre por parámetro. */
export type OosPhaseIEvaluation = Partial<Record<OosEvaluationKey, string>>;

export function readOosEvaluation(value: unknown): OosPhaseIEvaluation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: OosPhaseIEvaluation = {};
  for (const key of oosEvaluationKeys) {
    const entry = raw[key];
    if (typeof entry === "string" && entry.trim()) result[key] = entry.trim();
  }
  return result;
}

/** Fase vigente del OOS: la Fase II solo existe si la disposición de la Fase I es «a gran escala». */
export function oosPhase(disposition: OosPhaseIDisposition | null | undefined): "I" | "II" {
  return disposition === "FULL_SCALE" ? "II" : "I";
}

/** Resultados admitidos al cerrar en cada fase (árbol de decisiones, Anexo V). */
export function oosClosingResults(disposition: OosPhaseIDisposition | null | undefined): readonly OosInvestigationResult[] {
  if (disposition === "LAB_ERROR") return ["INVALIDATED"];
  if (disposition === "FULL_SCALE") return ["CONFIRMED", "INCONCLUSIVE"];
  return [];
}

export function formatOosDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10).split("-").reverse().join("/") : "—";
}
