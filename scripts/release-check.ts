/**
 * D-131: comprueba una versión antes de entregarla a IT y prepara su resumen.
 *
 *   pnpm release:check                 # compara con la última etiqueta vX.Y.Z
 *   pnpm release:check -- --from v0.2.0  # o con la entrega indicada (etiqueta o commit)
 *
 * Comprueba el número de versión, las notas y si la versión cambia la base de datos (migraciones nuevas
 * desde la entrega anterior). Termina con error si algo no cuadra. Solo lee el repositorio.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { releaseProblems } from "../src/lib/release/release-check";
import { releaseNotes } from "../src/lib/release/release-notes";

const root = path.resolve(__dirname, "..");
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function previousRelease(): string | null {
  const explicit = argument("--from");
  if (explicit) return explicit;
  // Última etiqueta de entrega alcanzable desde HEAD, sin contar HEAD si ya está etiquetado.
  const tags = git("tag", "--list", "v*", "--merged", "HEAD", "--sort=-v:refname").split("\n").filter(Boolean);
  const head = git("rev-parse", "HEAD");
  return tags.find((tag) => git("rev-list", "-n", "1", tag) !== head) ?? null;
}

function main() {
  const version = String(JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version);
  const from = previousRelease();
  let previousVersion: string | null = null;
  let newMigrations: string[] | null = null;
  if (from) {
    if (!/^[\w./-]+$/.test(from)) throw new Error(`Referencia no válida: ${from}`);
    previousVersion = String(JSON.parse(git("show", `${from}:package.json`)).version);
    newMigrations = git("diff", "--name-only", "--diff-filter=A", from, "HEAD", "--", "prisma/migrations")
      .split("\n").filter((file) => file.endsWith("/migration.sql")).map((file) => file.split("/")[2]).sort();
  }
  const problems = releaseProblems({ version, previousVersion, notes: releaseNotes, newMigrations });
  const note = releaseNotes.find((item) => item.version === version);

  console.log(`Versión ${version} · commit ${git("rev-parse", "HEAD")}`);
  console.log(from ? `Entrega anterior: ${from} (versión ${previousVersion})` : "Entrega anterior: ninguna etiqueta vX.Y.Z; no se comparan migraciones.");
  if (newMigrations) console.log(newMigrations.length ? `Cambios en la base de datos: ${newMigrations.length} migración(es) nueva(s):\n${newMigrations.map((name) => `  - ${name}`).join("\n")}` : "Cambios en la base de datos: ninguno.");
  if (note) {
    console.log(`\nNotas (${note.date}): ${note.summary}`);
    if (note.actions.length) console.log(`Qué deben hacer Calidad o IT:\n${note.actions.map((item) => `  - ${item}`).join("\n")}`);
  }
  console.log("\nAntes de instalarla: verificación de los anexos (pnpm annexes:verify, D-128), copia de seguridad previa" + (note?.database ? " y migraciones (pnpm db:deploy)" : "") + ". Procedimiento: docs/PROCEDIMIENTO_ACTUALIZACION.md.");
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
