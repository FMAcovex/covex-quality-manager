import { copyFile,mkdir,readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { auditedComplaintTemplateHashes } from "../src/modules/complaints/documents/templates";
const source=process.argv[2];
async function main(){if(!source)throw new Error("Uso: pnpm templates:complaints:install -- <GC-00-027-02.docx>");const b=await readFile(source);if(createHash("sha256").update(b).digest("hex")!==auditedComplaintTemplateHashes.legacyV02)throw new Error("El PNT de Reclamaciones no coincide con la copia auditada.");const dir=path.resolve("templates/complaints/v02");await mkdir(dir,{recursive:true});await copyFile(source,path.join(dir,"GC-00-027-02 Reclamaciones.docx"));console.log("Plantilla Reclamaciones v02 instalada.");}
main().catch(e=>{console.error(e);process.exitCode=1;});
