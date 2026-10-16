import type { GlobalSearchHit } from "./types";

export const GLOBAL_SEARCH_MIN_LENGTH = 2;
export const GLOBAL_SEARCH_MAX_LENGTH = 100;

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");

/** Normaliza la consulta: recorta, limita longitud y descarta consultas demasiado cortas. */
export function normalizeGlobalQuery(input: string | string[] | undefined): string | null {
  const value = (Array.isArray(input) ? input[0] : input)?.trim().slice(0, GLOBAL_SEARCH_MAX_LENGTH) ?? "";
  return value.length >= GLOBAL_SEARCH_MIN_LENGTH ? value : null;
}

/** Código exacto, después prefijo, después código que contiene, después resto; estable en empates. */
export function rankHits(query: string, hits: readonly GlobalSearchHit[]): GlobalSearchHit[] {
  const q = fold(query);
  const score = (hit: GlobalSearchHit) => {
    const code = fold(hit.code);
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    if (code.includes(q)) return 2;
    return 3;
  };
  return hits.map((hit, index) => ({ hit, index, score: score(hit) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ hit }) => hit);
}

export function summarize(...parts: Array<string | null | undefined>): string {
  const text = parts.filter((part): part is string => Boolean(part?.trim())).join(" · ").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}
