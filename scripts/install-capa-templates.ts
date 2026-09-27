import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const expected = {
  annexIII: "73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540",
  annexIV: "47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3",
};

function arg(name:string) {
  const index=process.argv.indexOf(name);
  return index>=0?process.argv[index+1]:undefined;
}
async function hash(file:string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function main() {
  const annexIII=arg("--annex-iii");
  const annexIV=arg("--annex-iv");
  if(!annexIII||!annexIV) {
    throw new Error("Uso: pnpm templates:capa:install -- --annex-iii <docx> --annex-iv <xlsx>");
  }
  if(await hash(annexIII)!==expected.annexIII) throw new Error("El Anexo III CAPA no coincide con la plantilla v05 auditada.");
  if(await hash(annexIV)!==expected.annexIV) throw new Error("El Anexo IV CAPA no coincide con la plantilla v05 auditada.");
  const target=path.resolve("templates/capa/v05");
  await mkdir(target,{recursive:true});
  await copyFile(annexIII,path.join(target,"Anexo III INFORME CAPA 05.docx"));
  await copyFile(annexIV,path.join(target,"Anexo IV LISTADO CAPA 05 oficial.xlsx"));
  console.log("Plantillas CAPA v05 instaladas y verificadas.");
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
