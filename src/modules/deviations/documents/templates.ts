import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export class TemplateUnavailableError extends Error {}

const ANNEX_III_SHA256 = "8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43";
const ANNEX_V_SHA256 = "18e7e4b7f53df7b07387c891005c1df229a7cb549e4885d52bb55550e4874817";

async function loadTemplate(configured: string | undefined, fallback: string, expectedSha: string) {
  const filePath = path.resolve(process.cwd(), configured || fallback);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new TemplateUnavailableError(
      `Plantilla no instalada: ${filePath}. Ejecuta pnpm templates:install con los anexos oficiales v06.`,
    );
  }
  const sha = createHash("sha256").update(buffer).digest("hex");
  if (sha !== expectedSha) {
    throw new TemplateUnavailableError(
      `La plantilla ${path.basename(filePath)} no coincide con la versión v06 auditada (SHA-256 inesperado).`,
    );
  }
  return buffer;
}

export function loadAnnexIIITemplate() {
  return loadTemplate(
    process.env.DEVIATION_ANNEX_III_TEMPLATE,
    "templates/deviations/v06/Anexo III Informe Desviaciones 06.docx",
    ANNEX_III_SHA256,
  );
}

export function loadAnnexVTemplate() {
  return loadTemplate(
    process.env.DEVIATION_ANNEX_V_TEMPLATE,
    "templates/deviations/v06/Anexo_V_Listado_de_Desviaciones_06.xlsx",
    ANNEX_V_SHA256,
  );
}

export const auditedTemplateHashes = {
  annexIII: ANNEX_III_SHA256,
  annexV: ANNEX_V_SHA256,
};
