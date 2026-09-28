import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { backupChecksum, createLogicalBackup } from "../src/lib/backup";

const prisma = new PrismaClient();

async function main() {
  const demoRecords = await prisma.qmsRecord.findMany({
    where: { businessCode: { startsWith: "DEMO-" } },
    select: { recordType: true, businessCode: true },
  });

  const expected = new Set([
    "DEMO-DES-001-2026",
    "DEMO-CAPA-001-2026",
    "DEMO-CC-001-2026",
    "DEMO-REC-001-2026",
    "DEMO-DEVOL-001-2026",
  ]);
  for (const row of demoRecords) {
    if (row.businessCode) expected.delete(row.businessCode);
  }
  if (expected.size) {
    throw new Error(`Faltan expedientes demo: ${[...expected].join(", ")}`);
  }

  const backup = await createLogicalBackup(prisma);
  if (backup.modelCount < 10) throw new Error("El backup no incluye todos los modelos esperados.");
  if ((backup.counts.QmsRecord ?? 0) < 5) throw new Error("El backup no contiene los expedientes demo.");

  const json = JSON.stringify(backup, null, 2);
  const checksum = backupChecksum(backup);
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("Checksum de backup no válido.");

  const dir = resolve("backups");
  const file = resolve(dir, "hito10-smoke.json");
  await mkdir(dir, { recursive: true });
  await writeFile(file, json, "utf8");
  const roundtrip = JSON.parse(await readFile(file, "utf8"));
  if (backupChecksum(roundtrip) !== checksum) {
    throw new Error("El backup cambia tras escritura/lectura JSON.");
  }

  const relations = await prisma.qmsRelation.count({
    where: {
      sourceRecord: { businessCode: { startsWith: "DEMO-" } },
      targetRecord: { businessCode: { startsWith: "DEMO-" } },
      isActive: true,
    },
  });
  if (relations < 2) throw new Error("Las relaciones QMS de demo no se han creado.");

  console.log("Hito 10 smoke OK");
  console.log(`Demo: ${demoRecords.length} expedientes · relaciones: ${relations}`);
  console.log(`Backup: ${backup.modelCount} modelos · SHA-256 ${checksum}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
