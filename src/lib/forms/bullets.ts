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
  return value.lastIndexOf("\n", index - 1) + 1;
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

/** Separa un texto en párrafos y listas de viñetas seguidas, para mostrarlo en la ficha. */
export function textBlocks(value: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let text: string[] = [];
  let separators: string[] = [];
  const lines = value.split(/(\r?\n)/);
  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index];
    const separator = lines[index + 1] ?? "";
    if (isBulletLine(line)) {
      if (text.length) blocks.push({ kind: "text", text: joinLines(text, separators) });
      text = [];
      separators = [];
      const item = bulletText(line);
      const last = blocks[blocks.length - 1];
      if (last?.kind === "bullets") last.items.push(item);
      else blocks.push({ kind: "bullets", items: [item] });
    } else {
      text.push(line);
      separators.push(separator);
    }
  }
  if (text.length && (text.length > 1 || text[0] || !blocks.length)) blocks.push({ kind: "text", text: joinLines(text, separators) });
  return blocks;
}

function joinLines(lines: string[], separators: string[]) {
  return lines.map((line, index) => line + (index < lines.length - 1 ? separators[index] : "")).join("");
}
