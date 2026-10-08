import { copyFile,mkdir,readFile,stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { auditedComplaintTemplateHashes as hashes } from "../src/modules/complaints/documents/templates";
const source=process.argv[2];
async function main(){
 if(!source)throw new Error("Indica carpeta de anexos GC-00/027/03 o PNT v02 histórico.");
 if(!(await stat(source)).isDirectory()){
  const b=await readFile(source);if(createHash("sha256").update(b).digest("hex")!==hashes.legacyV02)throw new Error("El PNT histórico no coincide con la copia auditada.");
  const dir=path.resolve("templates/complaints/v02");await mkdir(dir,{recursive:true});await copyFile(source,path.join(dir,"GC-00-027-02 Reclamaciones.docx"));return;
 }
 const specs=[
  {file:"Anexo III 03 INFORME RECLAMACION.docx",type:"COMPLAINT_ANNEX_III" as const,hash:hashes.annexIIIV03},
  // The controlled header says GC-00/027/03; the source file name still says 02.
  {file:"Anexo IV 02 RECLAMACION RESPUESTA.docx",type:"COMPLAINT_ANNEX_IV" as const,hash:hashes.annexIVV03},
  {file:"Anexo V 02 LISTADO DE RECLAMACIONES.xlsx",type:"COMPLAINT_ANNEX_V" as const,hash:hashes.annexVV03},
 ];
 const assets=await Promise.all(specs.map(async spec=>{
  const bytes=await readFile(path.join(source,spec.file));
  if(createHash("sha256").update(bytes).digest("hex")!==spec.hash)throw new Error(`SHA-256 no reconocido: ${spec.file}`);
  return {...spec,bytes};
 }));
 await prisma.$transaction(async tx=>{for(const asset of assets){
  const key={module:"COMPLAINT" as const,documentType:asset.type,versionCode:"03"};
  const existing=await tx.templateVersion.findUnique({where:{module_documentType_versionCode:key}});
  if(existing?.checksum&&existing.checksum!==asset.hash)throw new Error(`No se sustituye una plantilla histórica: ${asset.type}/03.`);
  const data={fileName:asset.file,fileData:asset.bytes,fileSize:asset.bytes.length,checksum:asset.hash,mimeType:asset.file.endsWith("xlsx")?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"};
  if(existing)await tx.templateVersion.update({where:{id:existing.id},data});
  else await tx.templateVersion.create({data:{...key,...data,effectiveFrom:new Date("2026-09-28"),isActive:true}});
 }});
 console.log("Anexos III/IV/V GC-00/027/03 verificados e instalados; históricos conservados.");
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
