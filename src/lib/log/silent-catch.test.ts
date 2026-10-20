import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");

function serverFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return serverFiles(full);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) return [];
    const head = readFileSync(full, "utf8").trimStart().slice(0, 20);
    return /^["']use client["']/.test(head) ? [] : [full];
  });
}

/** Desde `open` (índice de la llave o paréntesis de apertura) hasta su cierre, contando anidamiento. */
function balanced(source: string, open: number, opening: string, closing: string): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === opening) depth++;
    else if (source[i] === closing && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

/**
 * BE1-B (D-113): un `catch` de servidor que descarta el error debe registrarlo (`logServerError`) o explicar
 * con un comentario por qué es esperado. Lanzar otro error o usar la variable capturada (devolverla o pasarla)
 * cuenta como tratarlo.
 */
function silentCatches(source: string): number[] {
  const lines: number[] = [];
  const lineOf = (index: number) => source.slice(0, index).split("\n").length;
  for (const match of source.matchAll(/\bcatch\s*(?:\(\s*([A-Za-z_$][\w$]*)?[^)]*\))?\s*\{/g)) {
    if (source.slice(Math.max(0, match.index - 1), match.index) === ".") continue;
    const block = balanced(source, match.index + match[0].length - 1, "{", "}");
    const name = match[1];
    const handled = /logServerError|\/\/|\/\*|\bthrow\b/.test(block) || (name !== undefined && new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(block.slice(1)));
    if (!handled) lines.push(lineOf(match.index));
  }
  for (const match of source.matchAll(/\.catch\(/g)) {
    const call = balanced(source, match.index + match[0].length - 1, "(", ")");
    const parameter = call.match(/^\(\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)?/)?.[1];
    const body = call.replace(/^\(\s*(?:async\s*)?\(?\s*[\w$]*\s*\)?\s*=>/, "");
    const handled = /logServerError|\/\/|\/\*/.test(call) || (parameter !== undefined && new RegExp(`\\b${parameter}\\b`).test(body)) || !/=>/.test(call);
    if (!handled) lines.push(lineOf(match.index));
  }
  return lines;
}

describe("catch de servidor sin registro ni justificación (BE1-B)", () => {
  it("detecta los casos y respeta los tratados", () => {
    expect(silentCatches("try { a(); } catch { return null; }")).toEqual([1]);
    expect(silentCatches("try { a(); } catch (e) { return null; }")).toEqual([1]);
    expect(silentCatches("try { a(); } catch (e) { throw e; }")).toEqual([]);
    expect(silentCatches("try { a(); } catch { throw new Error(\"otro\"); }")).toEqual([]);
    expect(silentCatches("try { a(); } catch { /* entrada mal formada */ return null; }")).toEqual([]);
    expect(silentCatches("try { a(); } catch (e) { logServerError('x', e); }")).toEqual([]);
    expect(silentCatches("p.catch(() => null);")).toEqual([1]);
    expect(silentCatches("p.catch(() => null); // opcional")).toEqual([1]);
    expect(silentCatches("p.catch((e) => logServerError('x', e));")).toEqual([]);
    expect(silentCatches("p.catch(handler);")).toEqual([]);
  });

  it("ningún catch de servidor descarta un error sin registro ni justificación", () => {
    const found = serverFiles(path.join(root, "src")).flatMap(file =>
      silentCatches(readFileSync(file, "utf8")).map(line => `${path.relative(root, file).split(path.sep).join("/")}:${line}`));
    expect(found).toEqual([]);
  });

  it("el código de servidor no usa console.error ni console.warn (silenciados en producción)", () => {
    const allowed = new Set(["src/app/auth/demo/route.ts"]); // Diagnóstico local solo en modo demostración.
    const found = serverFiles(path.join(root, "src")).map(file => path.relative(root, file).split(path.sep).join("/"))
      .filter(file => !allowed.has(file) && /console\.(error|warn)\(/.test(readFileSync(path.join(root, file), "utf8")));
    expect(found).toEqual([]);
  });

  it("las traducciones de errores de Prisma a un texto genérico registran el fallo", () => {
    const found = serverFiles(path.join(root, "src")).map(file => path.relative(root, file).split(path.sep).join("/"))
      .filter(file => { const source = readFileSync(path.join(root, file), "utf8"); return /startsWith\("Prisma"\)|PrismaClientInitializationError/.test(source) && !source.includes("logServerError"); });
    expect(found).toEqual([]);
  });
});

