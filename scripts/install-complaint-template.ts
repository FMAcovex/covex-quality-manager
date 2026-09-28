import { copyFile,mkdir,readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { auditedComplaintTemplateHashes } from "../src/modules/complaints/documents/templates";

const arg=(name:string)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const hash=async(file:string)=>createHash("sha256").update(await readFile(file)).digest("hex");
async function verify(file:string,expected:string,label:string){if(await hash(file)!==expected)throw new Error(`${label} no coincide con la copia controlada suministrada.`);}

async function main(){
 const annexIII=arg("--annex-iii"),annexV=arg("--annex-v"),pnt=arg("--pnt");
 if(!annexIII||!annexV)throw new Error("Uso: pnpm templates:complaints:install -- --annex-iii <docx> --annex-v <xlsx> [--pnt <docx>]");
 await verify(annexIII,auditedComplaintTemplateHashes.annexIII,"Anexo III");
 await verify(annexV,auditedComplaintTemplateHashes.annexV,"Anexo V");
 if(pnt)await verify(pnt,auditedComplaintTemplateHashes.pnt,"PNT GC-00/027/03");
 const dir=path.resolve("templates/complaints/v03");await mkdir(dir,{recursive:true});
 await copyFile(annexIII,path.join(dir,"Anexo III INFORME RECLAMACION 03.docx"));
 await copyFile(annexV,path.join(dir,"Anexo V LISTADO DE RECLAMACIONES 03.xlsx"));
 if(pnt)await copyFile(pnt,path.join(dir,"GC-00.027.03 Reclamaciones.docx"));
 console.log("Plantillas de Reclamaciones GC-00/027/03 instaladas para pruebas.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
