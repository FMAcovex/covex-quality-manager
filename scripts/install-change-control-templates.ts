import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { auditedChangeControlTemplateHashes } from "../src/modules/change-control/documents/templates";

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function hash(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function verify(file: string, expected: string, label: string) {
  if (await hash(file) !== expected) {
    throw new Error(`${label} no coincide con la plantilla controlada auditada.`);
  }
}

async function main() {
  const annexIII = arg("--annex-iii");
  const annexIV = arg("--annex-iv");
  const annexV = arg("--annex-v");
  const annexVII = arg("--annex-vii");
  if (!annexIII || !annexIV || !annexV || !annexVII) {
    throw new Error(
      "Uso: pnpm templates:changes:install -- --annex-iii <docx> --annex-iv <docx> --annex-v <docx> --annex-vii <xlsx>",
    );
  }
  await verify(annexIII, auditedChangeControlTemplateHashes.annexIII, "Anexo III");
  await verify(annexIV, auditedChangeControlTemplateHashes.annexIV, "Anexo IV");
  await verify(annexV, auditedChangeControlTemplateHashes.annexV, "Anexo V");
  await verify(annexVII, auditedChangeControlTemplateHashes.annexVII, "Anexo VII");

  const target = path.resolve("templates/change-control/v03");
  await mkdir(target, { recursive: true });
  await copyFile(annexIII, path.join(target, "Anexo III Solicitud GC-00-003-03.docx"));
  await copyFile(annexIV, path.join(target, "Anexo IV Dictamen GC-00-003-03.docx"));
  await copyFile(annexV, path.join(target, "Anexo V Seguimiento GC-00-003-03.docx"));
  await copyFile(annexVII, path.join(target, "Anexo VII Listado GC-00-003-03.xlsx"));
  console.log("Plantillas de Controles de Cambios v03 instaladas y verificadas.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
