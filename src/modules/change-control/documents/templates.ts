import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export class ChangeControlTemplateUnavailableError extends Error {}

const HASHES={
  annexIII:"a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f",
  annexIV:"742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60",
  annexV:"3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4",
} as const;

async function load(configured:string|undefined,fallback:string,expected:string) {
  const filePath=path.resolve(process.cwd(),configured||fallback);
  let buffer:Buffer;
  try { buffer=await readFile(filePath); }
  catch {
    throw new ChangeControlTemplateUnavailableError(
      `Plantilla de control de cambios no instalada: ${filePath}. Ejecuta pnpm templates:changes:install.`,
    );
  }
  const sha=createHash("sha256").update(buffer).digest("hex");
  if(sha!==expected) throw new ChangeControlTemplateUnavailableError(
    `La plantilla ${path.basename(filePath)} no coincide con la versión GC-00/003/03 auditada.`,
  );
  return buffer;
}
function requireV03(version:string,name:string) {
  if(version!=="03") throw new ChangeControlTemplateUnavailableError(
    `No hay plantilla controlada instalada para ${name} versión ${version}.`,
  );
}
export function loadChangeAnnexIII(version="03") {
  requireV03(version,"Anexo III");
  return load(process.env.CHANGE_ANNEX_III_TEMPLATE,"templates/changes/v03/Anexo III Solicitud GC-00-003-03.docx",HASHES.annexIII);
}
export function loadChangeAnnexIV(version="03") {
  requireV03(version,"Anexo IV");
  return load(process.env.CHANGE_ANNEX_IV_TEMPLATE,"templates/changes/v03/Anexo IV Dictamen GC-00-003-03.docx",HASHES.annexIV);
}
export function loadChangeAnnexV(version="03") {
  requireV03(version,"Anexo V");
  return load(process.env.CHANGE_ANNEX_V_TEMPLATE,"templates/changes/v03/Anexo V Seguimiento GC-00-003-03.docx",HASHES.annexV);
}
export const auditedChangeTemplateHashes=HASHES;
