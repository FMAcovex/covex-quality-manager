import { qmsModules } from "@/modules/registry";

export const SAVED_VIEW_NAME_MAX = 60;
export const SAVED_VIEW_QUERY_MAX = 2000;
export const SAVED_VIEWS_PER_LIST_MAX = 30;

/** Listados que admiten vistas guardadas: los de cada módulo del registro. */
export const savedViewListPaths: readonly string[] = qmsModules.map((contract) => contract.href);

export class SavedViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SavedViewError";
  }
}

export function parseListPath(value: unknown): string {
  if (typeof value !== "string" || !savedViewListPaths.includes(value)) throw new SavedViewError("Listado no admitido para vistas guardadas.");
  return value;
}

export function parseViewName(value: unknown): string {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!name) throw new SavedViewError("Indica un nombre para la vista.");
  if (name.length > SAVED_VIEW_NAME_MAX) throw new SavedViewError(`El nombre admite como máximo ${SAVED_VIEW_NAME_MAX} caracteres.`);
  return name;
}

// Parámetros de navegación o técnicos que no forman parte de un filtro.
const ignoredParams = new Set(["page", "returnTo", "tab", "review", "thread"]);

/** Conserva solo los filtros de la URL, en orden estable; rechaza consultas excesivas. */
export function normalizeViewQuery(value: unknown): string {
  const raw = typeof value === "string" ? value.replace(/^\?/, "") : "";
  const params = new URLSearchParams(raw);
  const kept = [...params.entries()].filter(([key, item]) => !ignoredParams.has(key) && !key.startsWith("_") && item !== "");
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = new URLSearchParams(kept).toString();
  if (query.length > SAVED_VIEW_QUERY_MAX) throw new SavedViewError("La combinación de filtros es demasiado larga para guardarla.");
  return query;
}
