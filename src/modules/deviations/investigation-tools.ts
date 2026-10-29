import { z } from "zod";

/**
 * D-123: herramientas de análisis guiadas en la investigación de Desviaciones (5 porqués,
 * Ishikawa 6M y brainstorming). Son material de trabajo de la investigación: no forman parte del
 * Anexo III ni lo modifican. Cada causa es una hipótesis hasta que quien investiga la marca como
 * descartada o confirmada; solo una causa confirmada se puede llevar a «Causa raíz», y siempre con
 * un clic explícito. La aplicación no propone causas ni decide nada por sí sola.
 */
export const MAX_TOOL_CAUSES = 60;
export const MAX_WHYS = 5;
const MAX_TEXT = 1000;

export const CAUSE_STATUSES = [
  ["HYPOTHESIS", "Hipótesis"],
  ["DISCARDED", "Descartada"],
  ["CONFIRMED", "Confirmada"],
] as const;
export const TOOL_METHODS = [
  ["ISHIKAWA", "Ishikawa (6M)"],
  ["BRAINSTORMING", "Brainstorming"],
] as const;
/** Las 6M del Ishikawa (sin «No determinada», que solo existe como categoría de la causa raíz). */
export const ISHIKAWA_CATEGORIES = ["PEOPLE", "METHOD", "MACHINE", "MATERIAL", "ENVIRONMENT", "MEASUREMENT"] as const;

const text = z.string().trim().max(MAX_TEXT, `Máximo ${MAX_TEXT} caracteres.`);
const status = z.enum(["HYPOTHESIS", "DISCARDED", "CONFIRMED"], { errorMap: () => ({ message: "Estado de la causa no válido." }) });
const causeSchema = z.object({
  method: z.enum(["ISHIKAWA", "BRAINSTORMING"], { errorMap: () => ({ message: "Herramienta no válida." }) }),
  category: z.enum(ISHIKAWA_CATEGORIES, { errorMap: () => ({ message: "Categoría 6M no válida." }) }).nullable().default(null),
  text: text.min(1, "Cada causa necesita una descripción."),
  evidence: text.default(""),
  status,
}).superRefine((cause, ctx) => {
  if (cause.method === "ISHIKAWA" && !cause.category) ctx.addIssue({ code: "custom", message: "Cada causa del Ishikawa necesita su categoría (6M)." });
});
const fiveWhysSchema = z.object({
  problem: text.default(""),
  whys: z.array(text).max(MAX_WHYS, `Como máximo ${MAX_WHYS} porqués.`),
  status,
});
const toolsSchema = z.object({
  fiveWhys: fiveWhysSchema.nullable().default(null),
  causes: z.array(causeSchema).max(MAX_TOOL_CAUSES, `Como máximo ${MAX_TOOL_CAUSES} causas.`).default([]),
});

export type ToolCause = z.infer<typeof causeSchema>;
export type FiveWhys = z.infer<typeof fiveWhysSchema>;
export type InvestigationTools = z.infer<typeof toolsSchema>;

export const emptyInvestigationTools = (): InvestigationTools => ({ fiveWhys: null, causes: [] });

const filled = (value: unknown) => typeof value === "string" && value.trim() !== "";
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Quita los huecos del final de los porqués (los demás conservan su número). */
function trimTrailing(whys: unknown[]) {
  const end = whys.reduce<number>((last, why, index) => filled(why) || typeof why !== "string" ? index + 1 : last, 0);
  return whys.slice(0, end);
}

/** Quita las filas en blanco que deja el formulario; lo demás se valida tal cual. */
function withoutBlankRows(value: Record<string, unknown>) {
  const five = isObject(value.fiveWhys) ? value.fiveWhys : null;
  const whys = five && Array.isArray(five.whys) ? trimTrailing(five.whys) : five?.whys;
  const fiveWhys = five && (filled(five.problem) || (Array.isArray(whys) ? whys.length > 0 : whys !== undefined)) ? { ...five, whys } : null;
  const causes = Array.isArray(value.causes) ? value.causes.filter((cause) => !isObject(cause) || filled(cause.text) || filled(cause.evidence)) : value.causes;
  return { fiveWhys, causes };
}

/** Lee el campo oculto del formulario. Sin contenido devuelve null (no se guarda nada). */
export function parseInvestigationTools(raw: FormDataEntryValue | null): { tools: InvestigationTools | null; error?: string } {
  if (typeof raw !== "string" || !raw.trim()) return { tools: null };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { /* Entrada mal formada. */ return { tools: null, error: "Las herramientas de investigación no son válidas." }; }
  if (!isObject(value)) return { tools: null, error: "Las herramientas de investigación no son válidas." };
  const parsed = toolsSchema.safeParse(withoutBlankRows(value));
  if (!parsed.success) {
    // Los mensajes propios están en español; una forma inesperada (envío manipulado) da uno genérico.
    const issue = parsed.error.issues[0];
    return { tools: null, error: !issue || issue.code === "invalid_type" ? "Las herramientas de investigación no son válidas." : issue.message };
  }
  return { tools: parsed.data.fiveWhys || parsed.data.causes.length ? parsed.data : null };
}

/** Valor guardado (JSON de la base) a objeto tipado; lo que no encaje se ignora. */
export function storedInvestigationTools(value: unknown): InvestigationTools | null {
  const parsed = toolsSchema.safeParse(value);
  return parsed.success && (parsed.data.fiveWhys || parsed.data.causes.length) ? parsed.data : null;
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;
const str = (value: unknown) => typeof value === "string" ? value : "";

/**
 * Lo que el formulario envió en un guardado que no se completó, para volver a mostrarlo tal cual
 * (aunque no sea válido) y que no se pierda lo escrito. Nunca falla con formas extrañas.
 */
export function looseInvestigationTools(json: string | undefined): InvestigationTools | null {
  if (!json) return null;
  let value: unknown;
  try { value = JSON.parse(json); } catch { /* Ilegible: se parte de lo guardado. */ return null; }
  if (!isObject(value)) return null;
  const statuses = ["HYPOTHESIS", "DISCARDED", "CONFIRMED"] as const;
  const five = isObject(value.fiveWhys) ? value.fiveWhys : null;
  return {
    fiveWhys: five ? { problem: str(five.problem), whys: Array.isArray(five.whys) ? five.whys.slice(0, MAX_WHYS).map(str) : [], status: pick(five.status, statuses, "HYPOTHESIS") } : null,
    causes: (Array.isArray(value.causes) ? value.causes : []).filter(isObject).slice(0, MAX_TOOL_CAUSES).map((cause) => ({
      method: pick(cause.method, ["ISHIKAWA", "BRAINSTORMING"] as const, "BRAINSTORMING"),
      category: ISHIKAWA_CATEGORIES.includes(cause.category as never) ? cause.category as ToolCause["category"] : null,
      text: str(cause.text), evidence: str(cause.evidence), status: pick(cause.status, statuses, "HYPOTHESIS"),
    })),
  };
}

export type RootCauseSuggestion = { text: string; category: (typeof ISHIKAWA_CATEGORIES)[number] | null; method: "ISHIKAWA" | "BRAINSTORMING" | "FIVE_WHYS" };

/** Lo que copia «Usar como causa raíz»: solo de una causa (o cadena de porqués) confirmada. */
export function rootCauseSuggestion(source: ToolCause | FiveWhys): RootCauseSuggestion | null {
  if (source.status !== "CONFIRMED") return null;
  if ("whys" in source) {
    const last = [...source.whys].reverse().find((why) => why.trim());
    return last ? { text: last.trim(), category: null, method: "FIVE_WHYS" } : null;
  }
  return source.text.trim() ? { text: source.text.trim(), category: source.category, method: source.method } : null;
}

export const causeStatusLabel = (value: string) => CAUSE_STATUSES.find(([key]) => key === value)?.[1] ?? value;
