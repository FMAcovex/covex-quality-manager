import { copyFile,mkdir,readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const expected={
  iii:"a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f",
  iv:"742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60",
  v:"3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4",
};
function arg(n:string){const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined;}
async function hash(file:string){return createHash("sha256").update(await readFile(file)).digest("hex");}
async function main(){
  const iii=arg("--annex-iii"),iv=arg("--annex-iv"),v=arg("--annex-v");
  if(!iii||!iv||!v) throw new Error("Uso: pnpm templates:changes:install -- --annex-iii <docx> --annex-iv <docx> --annex-v <docx>");
  if(await hash(iii)!==expected.iii) throw new Error("Anexo III no coincide con la plantilla auditada.");
  if(await hash(iv)!==expected.iv) throw new Error("Anexo IV no coincide con la plantilla auditada.");
  if(await hash(v)!==expected.v) throw new Error("Anexo V no coincide con la plantilla auditada.");
  const target=path.resolve("templates/changes/v03");await mkdir(target,{recursive:true});
  await copyFile(iii,path.join(target,"Anexo III Solicitud GC-00-003-03.docx"));
  await copyFile(iv,path.join(target,"Anexo IV Dictamen GC-00-003-03.docx"));
  await copyFile(v,path.join(target,"Anexo V Seguimiento GC-00-003-03.docx"));
  console.log("Plantillas de Controles de Cambio v03 instaladas y verificadas.");
}
main().catch((e)=>{console.error(e);process.exitCode=1;});
