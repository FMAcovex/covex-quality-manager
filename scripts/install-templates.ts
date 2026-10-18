import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { readZip } from "../src/lib/ooxml/zip";
import { templateKey } from "../src/modules/configuration/template-catalog";
import {
  decideInstall,
  resolveCatalogTemplates,
  sha256,
  templateMimeType,
  type InputFile,
} from "../src/modules/configuration/template-install";

// D-099: único instalador de plantillas controladas. Recibe carpetas, ZIP o archivos sueltos,
// reconoce cada archivo por su SHA-256 (catálogo único) y nunca sustituye una versión
// instalada por otro binario. Solo lee los archivos: no ejecuta nada de los paquetes.
//
//   pnpm templates:install -- plantillas/
//   pnpm templates:install -- "ANEXOS PARA APP.zip" "GC-10-014-04 (15-06-2025).docx"

const officeFile = /\.(docx|xlsx|doc)$/i;

function collect(target: string, files: InputFile[]) {
  const stat = statSync(target);
  if (stat.isDirectory()) {
    for (const name of readdirSync(target).sort()) collect(path.join(target, name), files);
    return;
  }
  if (/\.zip$/i.test(target)) {
    for (const entry of readZip(readFileSync(target), { maxExpandedBytes: 512 * 1024 * 1024 })) {
      if (!entry.name.endsWith("/") && !entry.name.startsWith("__MACOSX/") && officeFile.test(entry.name)) files.push({ name: `${path.basename(target)} › ${entry.name}`, data: entry.data });
    }
    return;
  }
  if (officeFile.test(target)) files.push({ name: target, data: readFileSync(target) });
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

const json = (value: unknown) => value as Prisma.InputJsonValue;

async function main() {
  const targets = process.argv.slice(2).filter((arg) => arg !== "--");
  if (!targets.length) targets.push("plantillas");
  const files: InputFile[] = [];
  for (const target of targets) collect(path.resolve(target), files);
  const { resolved, missing, unrecognized, failed } = resolveCatalogTemplates(files, convertDoc);
  const actor = process.env.DEFAULT_ACTOR_NAME || "Instalación técnica de plantillas";
  const written: { label: string; key: { module: (typeof resolved)[number]["entry"]["module"]; documentType: (typeof resolved)[number]["entry"]["documentType"]; versionCode: string }; checksum: string }[] = [];
  const report: string[] = failed.map(({ entry, error }) => `✗ ${entry.label} · versión ${entry.versionCode}: no se ha podido preparar (${error})`);
  let conflicts = failed.length;

  await prisma.$transaction(async (tx) => {
    for (const { entry, data, checksum, sourceName, derived } of resolved) {
      const key = { module: entry.module, documentType: entry.documentType, versionCode: entry.versionCode };
      const existing = await tx.templateVersion.findUnique({ where: { module_documentType_versionCode: key } });
      const otherActive = await tx.templateVersion.count({ where: { module: entry.module, documentType: entry.documentType, isActive: true, NOT: { versionCode: entry.versionCode } } });
      const decision = decideInstall(entry, checksum, existing ? { checksum: existing.checksum, hasBinary: Boolean(existing.fileData || existing.filePath) } : null, otherActive > 0);
      if (decision.action === "unchanged") {
        report.push(`= ${entry.label} · versión ${entry.versionCode}: ya instalada`);
        continue;
      }
      if (decision.action === "conflict") {
        conflicts++;
        report.push(`✗ ${entry.label} · versión ${entry.versionCode}: ${decision.reason}`);
        continue;
      }
      const binary = { fileName: entry.fileName, mimeType: templateMimeType(entry.fileName), fileData: new Uint8Array(data), fileSize: data.length, checksum, filePath: null };
      const saved = decision.action === "create"
        ? await tx.templateVersion.create({ data: { ...key, ...binary, effectiveFrom: new Date(entry.effectiveFrom), isActive: decision.isActive } })
        : await tx.templateVersion.update({ where: { id: existing!.id }, data: binary });
      written.push({ label: entry.label, key, checksum });
      await tx.configurationChange.create({
        data: {
          entityType: "TemplateVersion",
          entityKey: templateKey(entry),
          action: decision.action === "create" ? "TEMPLATE_REGISTER" : decision.action === "fill" ? "TEMPLATE_BINARY_INSTALLED" : "TEMPLATE_REDERIVED",
          oldValue: existing ? json({ fileName: existing.fileName, fileSize: existing.fileSize, checksum: existing.checksum, isActive: existing.isActive }) : undefined,
          newValue: json({ fileName: saved.fileName, fileSize: saved.fileSize, checksum: saved.checksum, isActive: saved.isActive }),
          changedByText: actor,
          reason: `Instalación de plantilla controlada reconocida por SHA-256 · origen ${sourceName}${derived ? " (anexo derivado del original verificado)" : ""}`,
        },
      });
      report.push(`✓ ${entry.label} · versión ${entry.versionCode}: ${decision.action === "create" ? `instalada${saved.isActive ? "" : " (inactiva: actívala en Configuración → Versiones)"}` : decision.action === "fill" ? "instalada" : "sustituida la derivación anterior del mismo PNT"}`);
    }
  });

  // Comprobación posterior: lo guardado coincide con lo verificado.
  for (const { label, key, checksum } of written) {
    const row = await prisma.templateVersion.findUnique({ where: { module_documentType_versionCode: key }, select: { fileData: true, checksum: true } });
    if (!row?.fileData || row.checksum !== checksum || sha256(row.fileData) !== checksum) throw new Error(`${label}: fallo de integridad después de guardar.`);
  }

  console.log(report.join("\n") || "No se ha reconocido ninguna plantilla controlada.");
  if (unrecognized.length) console.log(`\nArchivos no reconocidos (se ignoran):\n${unrecognized.map((name) => `  · ${name}`).join("\n")}`);
  if (missing.length) console.log(`\nSin archivo de origen en lo indicado: ${missing.map((item) => `${item.label} · versión ${item.versionCode}`).join(", ")}`);
  if (conflicts) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
