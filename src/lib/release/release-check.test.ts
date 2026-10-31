import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareVersions, parseVersion, releaseNotesProblems, releaseProblems, type ReleaseNote } from "./release-check";
import { releaseNotes } from "./release-notes";

const note = (version: string, extra: Partial<ReleaseNote> = {}): ReleaseNote => ({ version, date: "2026-11-02", summary: "Resumen.", changes: ["Novedad."], fixes: [], actions: [], database: false, ...extra });

describe("D-131: número de versión", () => {
  it("MAYOR.MENOR.CORRECCIÓN, sin ceros a la izquierda ni sufijos", () => {
    expect(parseVersion("0.2.0")).toEqual([0, 2, 0]);
    expect(parseVersion(" 1.10.3 ")).toEqual([1, 10, 3]);
    for (const bad of ["1.2", "01.2.3", "1.2.3-rc1", "v1.2.3", "1.2.x", ""]) expect(parseVersion(bad), bad).toBeNull();
    expect(compareVersions([0, 10, 0], [0, 9, 9])).toBeGreaterThan(0);
    expect(compareVersions([1, 0, 0], [1, 0, 0])).toBe(0);
  });
});

describe("D-131: comprobación de una versión antes de entregarla", () => {
  it("una versión con sus notas, mayor que la anterior y sin migraciones se puede entregar", () => {
    expect(releaseProblems({ version: "0.2.1", previousVersion: "0.2.0", notes: [note("0.2.1"), note("0.2.0")], newMigrations: [] })).toEqual([]);
  });

  it("exige notas de la versión, que vayan primero y que la versión suba", () => {
    expect(releaseProblems({ version: "0.3.0", previousVersion: "0.2.0", notes: [note("0.2.0")], newMigrations: [] })).toEqual(["Faltan las notas de la versión 0.3.0 (src/lib/release/release-notes.ts)."]);
    expect(releaseProblems({ version: "0.2.0", previousVersion: "0.2.0", notes: [note("0.2.0")], newMigrations: [] })).toEqual(["La versión 0.2.0 debe ser mayor que la de la entrega anterior (0.2.0)."]);
    expect(releaseProblems({ version: "0.2.0", previousVersion: null, notes: [note("0.3.0"), note("0.2.0")], newMigrations: null })).toEqual(["Las notas de la versión 0.2.0 deben ser las primeras de la lista."]);
    expect(releaseProblems({ version: "0.2", previousVersion: null, notes: [], newMigrations: null })).toEqual(["package.json: «0.2» no es un número de versión MAYOR.MENOR.CORRECCIÓN."]);
  });

  it("los cambios en la base de datos se declaran en las notas y suben al menos el número MENOR", () => {
    expect(releaseProblems({ version: "0.2.1", previousVersion: "0.2.0", notes: [note("0.2.1")], newMigrations: ["20261102000100_x"] })).toEqual([
      "Hay 1 migración(es) nueva(s), pero las notas de la 0.2.1 no indican cambios en la base de datos.",
      "Con cambios en la base de datos la versión sube al menos el número MENOR (0.3.0), no solo la corrección.",
    ]);
    expect(releaseProblems({ version: "0.3.0", previousVersion: "0.2.0", notes: [note("0.3.0", { database: true })], newMigrations: ["20261102000100_x"] })).toEqual([]);
    expect(releaseProblems({ version: "0.3.0", previousVersion: "0.2.0", notes: [note("0.3.0", { database: true })], newMigrations: [] })).toEqual(["Las notas de la 0.3.0 indican cambios en la base de datos, pero no hay migraciones nuevas."]);
    // Sin entrega anterior conocida no se comparan migraciones.
    expect(releaseProblems({ version: "0.2.0", previousVersion: null, notes: [note("0.2.0", { database: true })], newMigrations: null })).toEqual([]);
  });

  it("las notas van de la más reciente a la más antigua, sin repetir, con fecha, resumen y contenido", () => {
    expect(releaseNotesProblems([note("0.2.0"), note("0.3.0")])).toEqual(["Notas: la 0.3.0 debe ir después de una versión mayor (de la más reciente a la más antigua, sin repetir)."]);
    expect(releaseNotesProblems([note("0.2.0"), note("0.2.0")])).toHaveLength(1);
    expect(releaseNotesProblems([note("0.2.0", { date: "31/10/2026", summary: " ", changes: [] })])).toEqual([
      "Notas 0.2.0: la fecha debe ser AAAA-MM-DD.",
      "Notas 0.2.0: falta el resumen.",
      "Notas 0.2.0: no hay novedades ni correcciones.",
    ]);
  });
});

describe("D-131: la versión del repositorio tiene sus notas", () => {
  it("package.json lleva una versión válida con notas, las primeras de la lista", () => {
    const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
    expect(releaseProblems({ version, previousVersion: null, notes: releaseNotes, newMigrations: null })).toEqual([]);
  });
});
