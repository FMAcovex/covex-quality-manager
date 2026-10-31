/**
 * D-131: comprueba una versión antes de entregarla a IT y prepara su resumen.
 *
 *   pnpm release:check                   # compara con la última etiqueta vX.Y.Z
 *   pnpm release:check -- --from v0.2.0  # o con la entrega indicada (etiqueta o commit)
 *   pnpm release:check -- --first-release  # solo la primera entrega, que no tiene anterior
 *
 * Comprueba el número de versión, las notas y si la versión cambia la base de datos (migraciones nuevas
 * desde la entrega anterior; las ya entregadas no pueden cambiar). Termina con error si algo no cuadra.
 * Solo lee el repositorio. Necesita las etiquetas (git fetch --tags) y un clon con la historia hasta la anterior.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { migrationChanges, previousReleaseTag, releaseProblems } from "../src/lib/release/release-check";
import { releaseNotes } from "../src/lib/release/release-notes";

const root = path.resolve(__dirname, "..");
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Falta el valor de ${name}.`);
  return value;
}

const lines = (value: string) => value.split("\n").filter(Boolean);

function previousRelease(tagsAtHead: string[]): string | null {
  const explicit = argument("--from");
  if (explicit) return explicit;
  // Etiqueta de entrega (vX.Y.Z) de versión más alta alcanzable desde HEAD, sin contar las del propio HEAD.
  return previousReleaseTag(lines(git("tag", "--list", "v*", "--merged", "HEAD")), tagsAtHead);
}

function main() {
  // Lo que se comprueba sale del commit: sin cambios pendientes en la versión, las notas ni las migraciones.
  const pending = git("status", "--porcelain", "--", "package.json", "src/lib/release", "prisma/migrations");
  if (pending) throw new Error(`Hay cambios sin confirmar en la versión, las notas o las migraciones:\n${pending}`);
  const version = String(JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version);
  const tagsAtHead = lines(git("tag", "--points-at", "HEAD"));
  const firstRelease = process.argv.includes("--first-release");
  const from = previousRelease(tagsAtHead);
  if (from && firstRelease) throw new Error("--first-release solo vale cuando no hay entrega anterior.");
  let previousVersion: string | null = null;
  let newMigrations: string[] | null = null;
  let alteredMigrations: string[] = [];
  if (from) {
    if (!/^[\w][\w./-]*$/.test(from)) throw new Error(`Referencia no válida: ${from}`);
    previousVersion = String(JSON.parse(git("show", `${from}:package.json`)).version);
    // Sin detección de renombrados: una migración renombrada sale como borrada + añadida, y se rechaza.
    const changes = migrationChanges(git("diff", "--no-renames", "--name-status", from, "HEAD", "--", "prisma/migrations"));
    newMigrations = changes.added;
    alteredMigrations = changes.altered;
  }
  const problems = releaseProblems({ version, previousVersion, notes: releaseNotes, newMigrations, alteredMigrations, firstRelease, tagsAtHead });
  const note = releaseNotes.find((item) => item.version === version);

  console.log(`Versión ${version} · commit ${git("rev-parse", "HEAD")}`);
  console.log(from ? `Entrega anterior: ${from} (versión ${previousVersion})` : firstRelease ? "Primera entrega: no hay anterior con la que comparar las migraciones." : "Entrega anterior: no se encuentra ninguna etiqueta vX.Y.Z.");
  if (newMigrations) console.log(newMigrations.length ? `Cambios en la base de datos: ${newMigrations.length} migración(es) nueva(s):\n${newMigrations.map((name) => `  - ${name}`).join("\n")}` : "Cambios en la base de datos: ninguno.");
  if (note) {
    console.log(`\nNotas (${note.date}): ${note.summary}`);
    if (note.actions.length) console.log(`Qué deben hacer Calidad o IT:\n${note.actions.map((item) => `  - ${item}`).join("\n")}`);
  }
  console.log("\nAntes de instalarla: verificación de los anexos (pnpm annexes:verify, D-128). Al instalarla: copia de seguridad previa y pnpm db:deploy (siempre; no hace nada si no hay migraciones pendientes). Procedimiento: docs/PROCEDIMIENTO_ACTUALIZACION.md.");
  if (problems.length) {
    console.error(`\nNo se puede entregar la versión ${version}:\n${problems.map((item) => `  - ${item}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`\nLa versión ${version} se puede entregar.`);
}

try {
  main();
} catch (error) {
  console.error(`No se ha podido comprobar la versión: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  process.exit(2);
}
