import { copyFile,mkdir,readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { auditedReturnTemplateHash } from "../src/modules/returns/documents/templates";
const source=process.argv[2];
async function main(){if(!source)throw new Error("Uso: pnpm templates:returns:install -- <GC-00-028-03.docx>");const b=await readFile(source);if(createHash("sha256").update(b).digest("hex")!==auditedReturnTemplateHash)throw new Error("El PNT de Devoluciones no coincide con la copia auditada.");const dir=path.resolve("templates/returns/v03");await mkdir(dir,{recursive:true});await copyFile(source,path.join(dir,"GC-00-028-03 Devoluciones.docx"));console.log("Plantilla Devoluciones v03 instalada.");}
main().catch(e=>{console.error(e);process.exitCode=1;});
