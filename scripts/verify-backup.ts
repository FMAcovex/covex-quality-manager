import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { backupChecksum, LOGICAL_BACKUP_FORMAT_VERSION } from "../src/lib/backup";

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const input = process.argv[2];
  if (!input) fail("Uso: pnpm backup:verify -- <ruta-backup.json>");

  const file = resolve(input);
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw) as {
    formatVersion?: number;
    application?: string;
    modelCount?: number;
    counts?: Record<string, number>;
    models?: Record<string, unknown[]>;
  };

  if (parsed.formatVersion !== LOGICAL_BACKUP_FORMAT_VERSION) {
    fail("Versión de formato de backup no soportada.");
  }
  if (parsed.application !== "covex-quality-manager") {
    fail("El archivo no corresponde a COVEX Quality Manager.");
  }
  if (!parsed.counts || !parsed.models) fail("Backup incompleto: faltan counts/models.");

  const modelNames = Object.keys(parsed.models).sort();
  if (parsed.modelCount !== modelNames.length) fail("modelCount no coincide con los modelos exportados.");

  for (const name of modelNames) {
    if (!Array.isArray(parsed.models[name])) fail(`Modelo ${name} no contiene un array.`);
    if (parsed.counts[name] !== parsed.models[name].length) {
      fail(`El recuento del modelo ${name} no coincide.`);
    }
  }

  const checksum = backupChecksum(parsed);
  console.log("Backup lógico válido.");
  console.log(`Modelos: ${modelNames.length}`);
  console.log(`Registros QMS: ${parsed.counts.QmsRecord ?? 0}`);
  console.log(`SHA-256 lógico: ${checksum}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
