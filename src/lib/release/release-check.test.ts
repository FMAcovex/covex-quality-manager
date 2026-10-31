import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareVersions, migrationChanges, parseVersion, previousReleaseTag, releaseNotesProblems, releaseProblems, releaseTagVersion, type ReleaseNote } from "./release-check";
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
    expect(releaseProblems({ version: "0.2.0", previousVersion: null, firstRelease: true, notes: [note("0.3.0"), note("0.2.0")], newMigrations: null })).toEqual(["Las notas de la versión 0.2.0 deben ser las primeras de la lista."]);
    expect(releaseProblems({ version: "0.2", previousVersion: null, firstRelease: true, notes: [], newMigrations: null })).toEqual(["package.json: «0.2» no es un número de versión MAYOR.MENOR.CORRECCIÓN."]);
  });

  it("los cambios en la base de datos se declaran en las notas y suben al menos el número MENOR", () => {
    expect(releaseProblems({ version: "0.2.1", previousVersion: "0.2.0", notes: [note("0.2.1")], newMigrations: ["20261102000100_x"] })).toEqual([
      "Hay 1 migración(es) nueva(s), pero las notas de la 0.2.1 no indican cambios en la base de datos.",
      "Con cambios en la base de datos la versión sube al menos el número MENOR (0.3.0), no solo la corrección.",
    ]);
    expect(releaseProblems({ version: "0.3.0", previousVersion: "0.2.0", notes: [note("0.3.0", { database: true })], newMigrations: ["20261102000100_x"] })).toEqual([]);
    expect(releaseProblems({ version: "0.3.0", previousVersion: "0.2.0", notes: [note("0.3.0", { database: true })], newMigrations: [] })).toEqual(["Las notas de la 0.3.0 indican cambios en la base de datos, pero no hay migraciones nuevas."]);
    // Solo en la primera entrega se acepta no tener anterior con la que comparar.
    expect(releaseProblems({ version: "0.2.0", previousVersion: null, firstRelease: true, notes: [note("0.2.0", { database: true })], newMigrations: null })).toEqual([]);
  });

  it("las notas van de la más reciente a la más antigua, sin repetir, con fecha, resumen y contenido", () => {
    expect(releaseNotesProblems([note("0.2.0"), note("0.3.0")])).toEqual(["Notas: la 0.3.0 debe ir después de una versión mayor (de la más reciente a la más antigua, sin repetir)."]);
    expect(releaseNotesProblems([note("0.2.0"), note("0.2.0")])).toHaveLength(1);
    for (const date of ["2026-13-01", "2026-02-30"]) expect(releaseNotesProblems([note("0.2.0", { date })]), date).toEqual(["Notas 0.2.0: la fecha debe ser AAAA-MM-DD."]);
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
    expect(releaseProblems({ version, previousVersion: null, firstRelease: true, notes: releaseNotes, newMigrations: null })).toEqual([]);
  });
});

describe("D-131: entrega anterior y migraciones (revisión independiente)", () => {
  it("sin entrega anterior falla, salvo en la primera entrega (clon sin etiquetas o superficial)", () => {
    expect(releaseProblems({ version: "0.3.0", previousVersion: null, notes: [note("0.3.0")], newMigrations: null })).toEqual([
      "No se encuentra la entrega anterior (etiqueta vX.Y.Z): trae las etiquetas (git fetch --tags) o indícala con --from; solo la primera entrega usa --first-release.",
    ]);
  });

  it("solo cuentan las etiquetas vMAYOR.MENOR.CORRECCIÓN, por versión y sin las del propio commit", () => {
    expect(releaseTagVersion("v0.2.0")).toEqual([0, 2, 0]);
    for (const tag of ["verify-baseline", "v0.2.0-rc1", "0.2.0", "v1.2"]) expect(releaseTagVersion(tag), tag).toBeNull();
    expect(previousReleaseTag(["verify-baseline", "v0.2.0-rc1", "v0.1.0", "v0.10.0", "v0.9.1"], [])).toBe("v0.10.0");
    expect(previousReleaseTag(["v0.2.0", "v0.3.0"], ["v0.3.0"])).toBe("v0.2.0");
    expect(previousReleaseTag(["verify-baseline"], [])).toBeNull();
  });

  it("una migración modificada, renombrada o borrada no se entrega; las nuevas se listan", () => {
    const diff = [
      "A\tprisma/migrations/20261102000100_nueva/migration.sql",
      "D\tprisma/migrations/20261029000100_change_control_models/migration.sql",
      "A\tprisma/migrations/20261101000100_renamed/migration.sql",
      "M\tprisma/migrations/20261030000100_deviation_text_tables/migration.sql",
    ].join("\n");
    const changes = migrationChanges(diff);
    expect(changes.added).toEqual(["20261101000100_renamed", "20261102000100_nueva"]);
    expect(changes.altered).toEqual([
      "D prisma/migrations/20261029000100_change_control_models/migration.sql",
      "M prisma/migrations/20261030000100_deviation_text_tables/migration.sql",
    ]);
    const problems = releaseProblems({ version: "0.3.0", previousVersion: "0.2.0", notes: [note("0.3.0", { database: true })], newMigrations: changes.added, alteredMigrations: changes.altered });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("Una migración ya entregada ha cambiado (D prisma/migrations/20261029000100_change_control_models/migration.sql)");
  });

  it("la etiqueta que ya tenga el commit coincide con la versión de package.json", () => {
    expect(releaseProblems({ version: "0.2.1", previousVersion: "0.2.0", notes: [note("0.2.1")], newMigrations: [], tagsAtHead: ["v0.3.0", "otra"] })).toEqual(["El commit ya tiene la etiqueta v0.3.0, que no coincide con la versión 0.2.1 de package.json."]);
    expect(releaseProblems({ version: "0.2.1", previousVersion: "0.2.0", notes: [note("0.2.1")], newMigrations: [], tagsAtHead: ["v0.2.1"] })).toEqual([]);
  });
});
