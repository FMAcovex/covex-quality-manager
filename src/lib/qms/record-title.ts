const MAX = 90;

/** Título de un borrador sin código: su texto descriptivo en una línea, recortado; si no hay, el título por defecto. */
export function draftRecordTitle(text: string | null | undefined, fallback: string): string {
  const line = (text ?? "").replace(/\s+/g, " ").trim();
  if (!line) return fallback;
  return line.length > MAX ? `${line.slice(0, MAX - 1).trimEnd()}…` : line;
}
