import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { writeZip } from "../src/lib/ooxml/zip";
import type { CatalogTemplate } from "../src/modules/configuration/template-catalog";
import { expandTemplateInput, sha256 } from "../src/modules/configuration/template-install";
import { installProblems, installTemplateFiles } from "../src/modules/configuration/template-install-service";
import { autoInstallSummary, installTemplatesFromDirectory } from "../src/modules/configuration/template-autoinstall";

// D-105/D-107: la instalación compartida por la terminal, Configuración y el arranque, con un catálogo ficticio.
const marker = "D105-" + randomUUID().slice(0, 8);
const docx = (text: string) => writeZip([{ name: "word/document.xml", data: Buffer.from(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`) }]);
const annex = docx(`Anexo ficticio ${marker}`);
const other = docx(`Otro archivo ${marker}`);
const entry = (versionCode: string, data: Buffer): CatalogTemplate => ({
  module: "DEVIATION", documentType: "DEVIATION_ANNEX_III", versionCode, label: `Anexo ficticio ${versionCode}`,
  fileName: `${versionCode}.docx`, effectiveFrom: "2096-01-01", sources: [{ kind: "file", sha256: sha256(data) }],
});
const first = entry(`${marker}-A`, annex);
const options = { actor: "Smoke D-105", origin: "prueba" };
const where = { module: "DEVIATION" as const, documentType: "DEVIATION_ANNEX_III" as const, versionCode: { startsWith: marker } };

async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("El smoke D-105 requiere una base ficticia con APP_ENV=test.");
  try {
    // Un ZIP con la plantilla renombrada y un archivo desconocido.
    const files = expandTemplateInput("paquete.zip", writeZip([{ name: "dentro/renombrado.docx", data: annex }, { name: "dentro/desconocido.docx", data: other }, { name: "dentro/instalar.sh", data: Buffer.from("no") }]));
    const activeBefore = await prisma.templateVersion.count({ where: { module: "DEVIATION", documentType: "DEVIATION_ANNEX_III", isActive: true } });
    const installed = await installTemplateFiles(files, { ...options, catalog: [first] });
    assert.deepEqual(installed.lines.map((line) => line.status), ["installed"]);
    assert.deepEqual(installed.unrecognized, ["paquete.zip › dentro/desconocido.docx"]);
    const saved = await prisma.templateVersion.findFirstOrThrow({ where: { ...where, versionCode: first.versionCode } });
    assert.equal(saved.checksum, sha256(annex));
    assert.equal(saved.isActive, activeBefore === 0, "solo queda activa si no hay otra versión activa");
    const history = await prisma.configurationChange.findFirstOrThrow({ where: { entityKey: `DEVIATION:DEVIATION_ANNEX_III:${first.versionCode}` } });
    assert.equal(history.action, "TEMPLATE_REGISTER");
    assert.match(history.reason ?? "", /\(prueba\) · origen paquete\.zip › dentro\/renombrado\.docx/);

    // Repetir no cambia nada; otro archivo para la misma versión no la sustituye.
    assert.deepEqual((await installTemplateFiles(files, { ...options, catalog: [first] })).lines.map((line) => line.status), ["unchanged"]);
    const conflict = await installTemplateFiles([{ name: "otro.docx", data: other }], { ...options, catalog: [{ ...first, sources: [{ kind: "file", sha256: sha256(other) }] }] });
    assert.deepEqual(conflict.lines.map((line) => line.status), ["conflict"]);
    assert.equal(installProblems(conflict), 1);
    assert.equal((await prisma.templateVersion.findFirstOrThrow({ where: { ...where, versionCode: first.versionCode } })).checksum, sha256(annex));

    // Si una escritura falla, no queda nada a medias.
    const second = entry(`${marker}-B`, other);
    const broken = { ...entry(`${marker}-C`, annex), effectiveFrom: "fecha no válida" };
    await assert.rejects(installTemplateFiles([{ name: "a.docx", data: annex }, { name: "b.docx", data: other }], { ...options, catalog: [second, broken] }));
    assert.equal(await prisma.templateVersion.count({ where: { ...where, versionCode: { in: [second.versionCode, broken.versionCode] } } }), 0);

    // D-107: al arrancar, desde la carpeta del servidor; repetir en cada arranque no escribe nada.
    const folder = mkdtempSync(path.join(tmpdir(), "covex-d107-"));
    try {
      const fromFolder = entry(`${marker}-D`, annex);
      assert.deepEqual(await installTemplatesFromDirectory(path.join(folder, "no-existe"), { catalog: [fromFolder] }), { status: "skipped", reason: "no-directory" });
      assert.deepEqual(await installTemplatesFromDirectory(folder, { catalog: [fromFolder] }), { status: "skipped", reason: "empty" });
      mkdirSync(path.join(folder, "auditorias"));
      writeFileSync(path.join(folder, "auditorias", "plantillas.zip"), writeZip([{ name: "Anexo.docx", data: annex }, { name: "instalar.sh", data: Buffer.from("no") }]));
      writeFileSync(path.join(folder, "LEEME.txt"), "se ignora");
      const first = await installTemplatesFromDirectory(folder, { catalog: [fromFolder] });
      assert.equal(first.status, "done");
      assert.deepEqual(first.status === "done" && first.report.lines.map((line) => line.status), ["installed"]);
      assert.match(autoInstallSummary(first), /1 instaladas, 0 ya estaban, 0 con problemas/);
      const history = await prisma.configurationChange.findFirstOrThrow({ where: { entityKey: `DEVIATION:DEVIATION_ANNEX_III:${fromFolder.versionCode}` } });
      assert.equal(history.changedByText, "Instalación automática al arrancar");
      assert.match(history.reason ?? "", /carpeta de plantillas del servidor/);
      const changes = await prisma.configurationChange.count();
      assert.match(autoInstallSummary(await installTemplatesFromDirectory(folder, { catalog: [fromFolder] })), /0 instaladas, 1 ya estaban/);
      assert.equal(await prisma.configurationChange.count(), changes, "un nuevo arranque no escribe nada");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
    console.log("D-105/D-107 OK: instalación compartida por huella (terminal, Configuración y arranque), sin sustituir versiones y con reversión completa.");
  } finally {
    await prisma.configurationChange.deleteMany({ where: { entityKey: { contains: marker } } });
    await prisma.templateVersion.deleteMany({ where });
  }
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exit(1);
});
