import { countLabels } from "@/lib/qms/analytics/trends";

// Categoría de causa raíz (6M), complementaria a la causa raíz redactada. Categorías GMP
// genéricas para analizar tendencias; no sustituyen a la investigación ni a su conclusión.
export const ROOT_CAUSE_CATEGORIES = [
  ["PEOPLE", "Mano de obra (personas)"],
  ["METHOD", "Método (procedimientos, instrucciones)"],
  ["MACHINE", "Máquina (equipos, instalaciones, sistemas)"],
  ["MATERIAL", "Material (materias primas, envases, intermedios)"],
  ["ENVIRONMENT", "Medio ambiente (condiciones ambientales, entorno)"],
  ["MEASUREMENT", "Medición (análisis, calibración, inspección)"],
  ["UNDETERMINED", "No determinada"],
] as const;

export type RootCauseCategoryValue = (typeof ROOT_CAUSE_CATEGORIES)[number][0];

const labels: Record<string, string> = Object.fromEntries(ROOT_CAUSE_CATEGORIES);
/** Etiqueta corta para listados y gráficos: el texto antes del paréntesis. */
const shortLabels: Record<string, string> = Object.fromEntries(
  ROOT_CAUSE_CATEGORIES.map(([value, label]) => [value, label.replace(/\s*\(.*\)$/, "")]),
);

export function rootCauseCategoryLabel(value: string, short = false) {
  return (short ? shortLabels : labels)[value] ?? value;
}

/** Valores válidos marcados en el formulario, sin duplicados y en el orden del catálogo. */
export function rootCauseCategoriesFrom(formData: FormData): RootCauseCategoryValue[] {
  const marked = new Set(formData.getAll("rootCauseCategories").filter((value): value is string => typeof value === "string"));
  return ROOT_CAUSE_CATEGORIES.map(([value]) => value).filter((value) => marked.has(value));
}

/** Menciones de categoría (6M) para el Pareto; un expediente puede tener varias. */
export function rootCauseCategoryMentions(rows: ReadonlyArray<{ rootCauseCategories?: readonly string[] }>) {
  return countLabels(rows.flatMap((row) => (row.rootCauseCategories?.length
    ? row.rootCauseCategories.map((value) => rootCauseCategoryLabel(value, true))
    : ["Sin categoría"])));
}

/** Texto del Pareto por categoría: se cuentan menciones, no expedientes. */
export const ROOT_CAUSE_PARETO_VIEW = {
  unit: "menciones",
  note: "Un expediente puede tener varias categorías: el porcentaje es sobre el total marcado. «Sin categoría»: expedientes sin clasificar.",
} as const;
