import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeHistoricalImport,
  applyHistoricalImport,
} from "@/modules/deviations/import/import-service";

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function has(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const file = arg("--file");
  if (!file) throw new Error("Uso: pnpm import:deviations -- --file <xlsx> [--years 2025,2026] [--apply --confirm APPLY_2025_2026 --actor <nombre>]");

  const sourcePath = path.resolve(file);
  const buffer = await readFile(sourcePath);
  const years = (arg("--years") ?? "2025,2026")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => value === 2025 || value === 2026);
  if (!years.length) throw new Error("Solo se admiten 2025 y/o 2026 en este hito.");

  const apply = has("--apply");
  const actor = arg("--actor") ?? "Importación histórica";
  if (apply && arg("--confirm") !== "APPLY_2025_2026") {
    throw new Error("La importación real requiere --confirm APPLY_2025_2026. Sin ello solo debe ejecutarse dry-run.");
  }

  const report = apply
    ? await applyHistoricalImport(buffer, path.basename(sourcePath), actor, years)
    : (await analyzeHistoricalImport(buffer, path.basename(sourcePath), years)).report;

  const reportDir = path.resolve("reports/imports");
  await mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `deviations-${report.mode}-${stamp}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report.counts, null, 2));
  console.log(`Informe: ${reportPath}`);
  if (!apply) {
    console.log("DRY-RUN: no se ha escrito ningún expediente en la base de datos.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
