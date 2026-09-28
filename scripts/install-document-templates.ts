import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const expected = {
  annexIII: "8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43",
  annexV: "1f92410bc94e2037fe632450ce766b3ce5d44c4f55b8868056bad73c882c03f2",
};

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
async function hash(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function main() {
  const annexIII = arg("--annex-iii");
  const annexV = arg("--annex-v");
  if (!annexIII || !annexV) {
    throw new Error("Uso: pnpm templates:install -- --annex-iii <docx> --annex-v <xlsx>");
  }
  if (await hash(annexIII) !== expected.annexIII) throw new Error("El Anexo III no coincide con la plantilla v06 auditada.");
  if (await hash(annexV) !== expected.annexV) throw new Error("El Anexo V no coincide con la plantilla v06 auditada.");

  const target = path.resolve("templates/deviations/v06");
  await mkdir(target, { recursive: true });
  await copyFile(annexIII, path.join(target, "Anexo III Informe Desviaciones 06.docx"));
  await copyFile(annexV, path.join(target, "Anexo_V_Listado_de_Desviaciones_06.xlsx"));
  console.log("Plantillas v06 instaladas y verificadas.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
