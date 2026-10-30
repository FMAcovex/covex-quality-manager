import { z } from "zod";
import { rootCauseCategoryLabel } from "@/lib/qms/root-cause-categories";

/**
 * D-123/D-124: herramientas de análisis guiadas en la investigación de Desviaciones (5 porqués,
 * Ishikawa 6M, brainstorming y FTA). Cada causa es una hipótesis hasta que quien investiga la marca
 * como descartada o confirmada; solo una causa confirmada se puede llevar a «Causa raíz», y siempre
 * con un clic explícito. La aplicación no propone causas ni decide nada por sí sola. Desde D-124
 * todas las herramientas usadas se imprimen como texto en la casilla de causa raíz del Anexo III.
 */
export const MAX_TOOL_CAUSES = 60;
export const MAX_WHYS = 5;
export const MAX_FTA_DEPTH = 4;
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
/** FTA: lista en esquema (cada causa con su nivel); `gate` indica cómo se combinan sus causas de debajo. */
const ftaNodeSchema = z.object({
  depth: z.number().int().min(1).max(MAX_FTA_DEPTH, `Como máximo ${MAX_FTA_DEPTH} niveles en el árbol de fallos.`),
  text: text.min(1, "Cada causa necesita una descripción."),
  evidence: text.default(""),
  status,
  gate: z.enum(["OR", "AND"], { errorMap: () => ({ message: "Relación entre causas no válida." }) }).default("OR"),
});
const ftaSchema = z.object({
  top: text.default(""),
  nodes: z.array(ftaNodeSchema).max(MAX_TOOL_CAUSES, `Como máximo ${MAX_TOOL_CAUSES} causas en el árbol de fallos.`),
}).superRefine((fta, ctx) => {
  // Cada causa cuelga de la anterior de un nivel menos: el primer nivel empieza en 1 y no se saltan niveles.
  if (fta.nodes.some((node, index) => node.depth > (index === 0 ? 1 : fta.nodes[index - 1].depth + 1))) {
    ctx.addIssue({ code: "custom", message: "El árbol de fallos no es válido: cada causa cuelga del nivel anterior." });
  }
});
const toolsSchema = z.object({
  fiveWhys: fiveWhysSchema.nullable().default(null),
  causes: z.array(causeSchema).max(MAX_TOOL_CAUSES, `Como máximo ${MAX_TOOL_CAUSES} causas.`).default([]),
  fta: ftaSchema.nullable().default(null),
});

export type ToolCause = z.infer<typeof causeSchema>;
export type FiveWhys = z.infer<typeof fiveWhysSchema>;
export type FtaNode = z.infer<typeof ftaNodeSchema>;
export type Fta = z.infer<typeof ftaSchema>;
export type InvestigationTools = z.infer<typeof toolsSchema>;

export const emptyInvestigationTools = (): InvestigationTools => ({ fiveWhys: null, causes: [], fta: null });
const hasTools = (tools: InvestigationTools) => !!tools.fiveWhys || tools.causes.length > 0 || !!tools.fta;

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
  const tree = isObject(value.fta) ? value.fta : null;
  const nodes = tree && Array.isArray(tree.nodes) ? tree.nodes.filter((node) => !isObject(node) || filled(node.text) || filled(node.evidence)) : tree?.nodes;
  const fta = tree && (filled(tree.top) || (Array.isArray(nodes) ? nodes.length > 0 : nodes !== undefined)) ? { ...tree, nodes } : null;
  return { fiveWhys, causes, fta };
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
  return { tools: hasTools(parsed.data) ? parsed.data : null };
}

/** Valor guardado (JSON de la base) a objeto tipado; lo que no encaje se ignora. */
export function storedInvestigationTools(value: unknown): InvestigationTools | null {
  const parsed = toolsSchema.safeParse(value);
  return parsed.success && hasTools(parsed.data) ? parsed.data : null;
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
  const tree = isObject(value.fta) ? value.fta : null;
  return {
    fiveWhys: five ? { problem: str(five.problem), whys: Array.isArray(five.whys) ? five.whys.slice(0, MAX_WHYS).map(str) : [], status: pick(five.status, statuses, "HYPOTHESIS") } : null,
    causes: (Array.isArray(value.causes) ? value.causes : []).filter(isObject).slice(0, MAX_TOOL_CAUSES).map((cause) => ({
      method: pick(cause.method, ["ISHIKAWA", "BRAINSTORMING"] as const, "BRAINSTORMING"),
      category: ISHIKAWA_CATEGORIES.includes(cause.category as never) ? cause.category as ToolCause["category"] : null,
      text: str(cause.text), evidence: str(cause.evidence), status: pick(cause.status, statuses, "HYPOTHESIS"),
    })),
    fta: tree ? {
      top: str(tree.top),
      nodes: (Array.isArray(tree.nodes) ? tree.nodes : []).filter(isObject).slice(0, MAX_TOOL_CAUSES).map((node) => ({
        depth: Math.min(MAX_FTA_DEPTH, Math.max(1, Number.isInteger(node.depth) ? node.depth as number : 1)),
        text: str(node.text), evidence: str(node.evidence), status: pick(node.status, statuses, "HYPOTHESIS"), gate: pick(node.gate, ["OR", "AND"] as const, "OR"),
      })),
    } : null,
  };
}

export type RootCauseSuggestion = { text: string; category: (typeof ISHIKAWA_CATEGORIES)[number] | null; method: "ISHIKAWA" | "BRAINSTORMING" | "FIVE_WHYS" | "FTA" };

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

/** En el FTA una causa es final si la siguiente no cuelga de ella. */
export const ftaIsLeaf = (nodes: readonly Pick<FtaNode, "depth">[], index: number) => !nodes[index + 1] || nodes[index + 1].depth <= nodes[index].depth;

/** «Usar como causa raíz» en el FTA: solo una causa final y confirmada. */
export function ftaSuggestion(fta: Pick<Fta, "nodes">, index: number): RootCauseSuggestion | null {
  const node = fta.nodes[index];
  if (!node || node.status !== "CONFIRMED" || !ftaIsLeaf(fta.nodes, index) || !node.text.trim()) return null;
  return { text: node.text.trim(), category: null, method: "FTA" };
}

const statusText = (value: string, evidence: string) => `(${causeStatusLabel(value).toLowerCase()}${evidence.trim() ? `; evidencia: ${evidence.trim()}` : ""})`;

/** Líneas del análisis de cada herramienta usada, para imprimir debajo de la causa raíz (D-124). */
function toolsAnnexBlocks(tools: InvestigationTools): string[][] {
  const blocks: string[][] = [];
  if (tools.fiveWhys) {
    const five = tools.fiveWhys;
    blocks.push([
      `Análisis — 5 porqués (${causeStatusLabel(five.status).toLowerCase()})`,
      ...(five.problem.trim() ? [`Problema: ${five.problem.trim()}`] : []),
      ...five.whys.map((why, index) => `${index + 1}. ¿Por qué? ${why.trim() || "—"}`),
    ]);
  }
  const ishikawa = tools.causes.filter((cause) => cause.method === "ISHIKAWA");
  if (ishikawa.length) {
    blocks.push(["Análisis — Ishikawa (6M)", ...ISHIKAWA_CATEGORIES.flatMap((category) => ishikawa
      .filter((cause) => cause.category === category)
      .map((cause) => `${rootCauseCategoryLabel(category, true)}: ${cause.text.trim()} ${statusText(cause.status, cause.evidence)}`))]);
  }
  const brainstorming = tools.causes.filter((cause) => cause.method === "BRAINSTORMING");
  if (brainstorming.length) {
    blocks.push(["Análisis — Brainstorming", ...brainstorming.map((cause) =>
      `- ${cause.text.trim()}${cause.category ? ` [${rootCauseCategoryLabel(cause.category, true)}]` : ""} ${statusText(cause.status, cause.evidence)}`)]);
  }
  if (tools.fta) {
    const { top, nodes } = tools.fta;
    blocks.push([
      "Análisis — FTA (árbol de fallos)",
      ...(top.trim() ? [`Evento principal: ${top.trim()}`] : []),
      ...nodes.map((node, index) => `${"    ".repeat(node.depth - 1)}- ${node.text.trim()} ${statusText(node.status, node.evidence)}${ftaIsLeaf(nodes, index) ? "" : ` — sus causas: ${node.gate === "AND" ? "todas a la vez (Y)" : "basta una (O)"}`}`),
    ]);
  }
  return blocks;
}

/** Casilla «Causa raíz» del Anexo III: la causa raíz redactada y, debajo, el análisis de todas las herramientas usadas. */
export function rootCauseAnnexText(rootCause: string | null | undefined, tools: InvestigationTools | null): string {
  const parts = [rootCause?.trim() ?? "", ...(tools ? toolsAnnexBlocks(tools).map((lines) => lines.join("\n")) : [])].filter(Boolean);
  return parts.join("\n\n");
}
