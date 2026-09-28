import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { backupChecksum, createLogicalBackup } from "../src/lib/backup";

const prisma = new PrismaClient();

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function defaultOutput() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve("backups", `covex-quality-manager-${timestamp}.json`);
}

async function main() {
  const output = resolve(argument("--out") ?? defaultOutput());
  const backup = await createLogicalBackup(prisma);
  const json = JSON.stringify(backup, null, 2);
  const checksum = backupChecksum(backup);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, json, "utf8");
  await writeFile(`${output}.sha256`, `${checksum}  ${output.split(/[\\/]/).pop()}\n`, "utf8");

  console.log(`Backup lógico: ${output}`);
  console.log(`SHA-256: ${checksum}`);
  console.log(`Modelos: ${backup.modelCount}`);
  console.log(`Registros QMS: ${backup.counts.QmsRecord ?? 0}`);
}

main()
  .catch((error) => {
    console.error("No se pudo generar el backup lógico.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
