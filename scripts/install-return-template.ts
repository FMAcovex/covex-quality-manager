import { copyFile,mkdir,readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { auditedReturnTemplateHashes } from "../src/modules/returns/documents/templates";

const arg=(name:string)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const hash=async(file:string)=>createHash("sha256").update(await readFile(file)).digest("hex");
async function verify(file:string,expected:string,label:string){if(await hash(file)!==expected)throw new Error(`${label} no coincide con la copia controlada suministrada.`);}

async function main(){
 const annexIII=arg("--annex-iii"),pnt=arg("--pnt"),annexVI=arg("--annex-vi");
 if(!annexIII||!pnt||!annexVI)throw new Error("Uso: pnpm templates:returns:install -- --annex-iii <docx> --pnt <docx> --annex-vi <xlsx>");
 await verify(annexIII,auditedReturnTemplateHashes.annexIII,"Anexo III");
 await verify(pnt,auditedReturnTemplateHashes.pnt,"PNT GC-00/028/03");
 await verify(annexVI,auditedReturnTemplateHashes.annexVI,"Anexo VI");
 const dir=path.resolve("templates/returns/v03");await mkdir(dir,{recursive:true});
 await copyFile(annexIII,path.join(dir,"Anexo III FORMULARIO DEV 03.docx"));
 await copyFile(pnt,path.join(dir,"GC-00.028.03 DEV PRODUCTO.docx"));
 await copyFile(annexVI,path.join(dir,"Anexo VI LISTADO DEV 03.xlsx"));
 console.log("Plantillas de Devoluciones GC-00/028/03 instaladas y verificadas.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
