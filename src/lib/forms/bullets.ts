// D-126: viñetas en los textos largos. Se guardan como texto normal: cada viñeta es una línea que
// empieza por «• ». Así el buscador, el historial y las versiones no cambian, y un texto antiguo
// (por ejemplo, líneas con «-») se queda como está.

export const BULLET_PREFIX = "• ";

/** Cambio sobre el texto de un campo: sustituir [from, to) por `text` y dejar esa selección. */
export type TextEdit = { from: number; to: number; text: string; selectionStart: number; selectionEnd: number };

export type TextBlock = { kind: "text"; text: string } | { kind: "bullets"; items: string[] };

export function isBulletLine(line: string) {
  return /^•(?:[ \t]|\r?$)/.test(line);
}

/** El texto de una viñeta, sin el «• ». */
export function bulletText(line: string) {
  return line.replace(/^•[ \t]?/, "");
}

function lineStartAt(value: string, index: number) {
  return index <= 0 ? 0 : value.lastIndexOf("\n", index - 1) + 1;
}

function lineEndAt(value: string, index: number) {
  const end = value.indexOf("\n", index);
  return end === -1 ? value.length : end;
}

/** Pone viñeta a las líneas seleccionadas (o a la del cursor), o la quita si todas la tienen. */
export function toggleBullets(value: string, selectionStart: number, selectionEnd: number): TextEdit {
  // Una selección que acaba al principio de una línea no incluye esa línea.
  const lastIndex = selectionEnd > selectionStart && value[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd;
  const from = lineStartAt(value, selectionStart);
  const to = lineEndAt(value, lastIndex);
  const lines = value.slice(from, to).split("\n");
  const filled = lines.filter((line) => line.trim());
  const remove = filled.length > 0 && filled.every(isBulletLine);
  const next = lines.map((line) => {
    if (remove) return isBulletLine(line) ? bulletText(line) : line;
    if (!line.trim()) return lines.length === 1 ? BULLET_PREFIX : line;
    return isBulletLine(line) ? line : BULLET_PREFIX + line;
  });
  const text = next.join("\n");
  if (selectionStart === selectionEnd) {
    const caret = Math.max(from, selectionStart + text.length - (to - from));
    return { from, to, text, selectionStart: caret, selectionEnd: caret };
  }
  return { from, to, text, selectionStart: from, selectionEnd: from + text.length };
}

/** Intro dentro de una viñeta: crea la siguiente, o termina la lista si la viñeta está vacía. */
export function continueBullet(value: string, selectionStart: number, selectionEnd: number): TextEdit | null {
  if (selectionStart !== selectionEnd) return null;
  const from = lineStartAt(value, selectionStart);
  const to = lineEndAt(value, selectionStart);
  const line = value.slice(from, to);
  if (!isBulletLine(line)) return null;
  const contentStart = from + (line.length - bulletText(line).length);
  if (selectionStart < contentStart) return null;
  if (!bulletText(line).trim()) return { from, to, text: "", selectionStart: from, selectionEnd: from };
  const caret = selectionStart + 1 + BULLET_PREFIX.length;
  return { from: selectionStart, to: selectionStart, text: "\n" + BULLET_PREFIX, selectionStart: caret, selectionEnd: caret };
}

/**
 * Limpieza en el servidor de un texto largo: quita las viñetas vacías (un «•» sin texto, que deja el
 * Intro tras la última viñeta) y los espacios de los extremos. Sin texto, null: no cuenta como relleno.
 */
export function cleanText(value: string): string | null {
  return value.replace(/^•[ \t]*(?:\r?\n|$)/gm, "").trim() || null;
}

/** Un campo de texto de un formulario enviado, limpio como `cleanText` (null si falta o queda vacío). */
export function formText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? cleanText(value) : null;
}

/** Separa un texto en párrafos y listas de viñetas seguidas, para mostrarlo en la ficha. */
export function textBlocks(value: string): TextBlock[] {
  const lines = value.split(/\r?\n/);
  if (!lines.some(isBulletLine)) return [{ kind: "text", text: value }];
  const blocks: TextBlock[] = [];
  let text: string[] = [];
  // Las líneas en blanco junto a una lista van como bloques vacíos propios: se ven igual antes y después.
  const flush = (final: boolean) => {
    let start = 0, end = text.length;
    while (start < end && !text[start].trim()) start++;
    while (end > start && !text[end - 1].trim()) end--;
    const empty = { kind: "text", text: "" } as const;
    if (blocks.length) for (let index = 0; index < start; index++) blocks.push({ ...empty });
    if (end > start) blocks.push({ kind: "text", text: text.slice(start, end).join("\n") });
    if (!final) for (let index = end; index < text.length; index++) blocks.push({ ...empty });
    text = [];
  };
  for (const line of lines) {
    if (!isBulletLine(line)) {
      text.push(line);
      continue;
    }
    flush(false);
    const item = bulletText(line);
    if (!item.trim()) continue;
    const last = blocks[blocks.length - 1];
    if (last?.kind === "bullets") last.items.push(item);
    else blocks.push({ kind: "bullets", items: [item] });
  }
  flush(true);
  return blocks;
}
