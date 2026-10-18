import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { expandTemplateInput, type InputFile } from "../src/modules/configuration/template-install";
import { installProblems, installTemplateFiles } from "../src/modules/configuration/template-install-service";

// D-099: instalador de plantillas controladas por terminal. Recibe carpetas, ZIP o archivos
// sueltos, reconoce cada archivo por su SHA-256 (catálogo único) y nunca sustituye una versión
// instalada por otro binario. Solo lee los archivos: no ejecuta nada de los paquetes. La misma
// instalación está en Configuración → Versiones → «Instalar plantillas» (D-105).
//
//   pnpm templates:install -- plantillas/
//   pnpm templates:install -- "ANEXOS PARA APP.zip" "GC-10-014-04 (15-06-2025).docx"

function collect(target: string, files: InputFile[]) {
  if (statSync(target).isDirectory()) {
    for (const name of readdirSync(target).sort()) collect(path.join(target, name), files);
    return;
  }
  if (/\.(zip|docx|xlsx|doc)$/i.test(target)) {
    const name = /\.zip$/i.test(target) ? path.basename(target) : target;
    files.push(...expandTemplateInput(name, readFileSync(target)));
  }
}

function convertDoc(doc: Buffer) {
  const scratch = mkdtempSync(path.join(tmpdir(), "covex-template-doc-"));
  try {
    const copy = path.join(scratch, "template.doc");
    writeFileSync(copy, doc);
    execFileSync(process.env.LIBREOFFICE_BIN || "soffice", [`-env:UserInstallation=file://${scratch}/profile`, "--headless", "--convert-to", "docx", "--outdir", scratch, copy], { timeout: 120000, stdio: "pipe" });
    return readFileSync(path.join(scratch, "template.docx"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

const marks = { installed: "✓", unchanged: "=", conflict: "✗", failed: "✗" } as const;

async function main() {
  const targets = process.argv.slice(2).filter((arg) => arg !== "--");
  if (!targets.length) targets.push("plantillas");
  const files: InputFile[] = [];
  for (const target of targets) collect(path.resolve(target), files);
  const report = await installTemplateFiles(files, {
    actor: process.env.DEFAULT_ACTOR_NAME || "Instalación técnica de plantillas",
    origin: "pnpm templates:install",
    convertDoc,
  });
  console.log(report.lines.map((line) => `${marks[line.status]} ${line.label} · versión ${line.versionCode}: ${line.message}`).join("\n") || "No se ha reconocido ninguna plantilla controlada.");
  if (report.unrecognized.length) console.log(`\nArchivos no reconocidos (se ignoran):\n${report.unrecognized.map((name) => `  · ${name}`).join("\n")}`);
  if (report.missing.length) console.log(`\nSin archivo de origen en lo indicado: ${report.missing.join(", ")}`);
  if (installProblems(report)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
