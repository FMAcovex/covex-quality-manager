import {copyFile,mkdir,readFile,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import {PrismaClient,DocumentType} from "@prisma/client";
import {auditedReturnTemplateHashes} from "../src/modules/returns/documents/templates";
const source=process.argv.slice(2).find(x=>x!=="--");
const files=[
 ["A3 FORMULARIO DEV 03.docx",DocumentType.RETURN_ANNEX_III,auditedReturnTemplateHashes.annexIIIV03],
 ["A4 PETICION DEV 03.docx",DocumentType.RETURN_ANNEX_IV,auditedReturnTemplateHashes.currentAnnexIVV03],
 ["A5 DECLARACION CLIENTE 03.docx",DocumentType.RETURN_ANNEX_V,auditedReturnTemplateHashes.currentAnnexVV03],
 ["A6 LISTADO DEV 03.xlsx",DocumentType.RETURN_ANNEX_VI,auditedReturnTemplateHashes.annexVIV03],
] as const;
async function main(){
 if(!source)throw new Error("Uso: pnpm templates:returns:install -- <carpeta autorizada | PNT.docx>");
 const dir=path.resolve("templates/returns/v03");
 if(!(await stat(source)).isDirectory()){
  const bytes=await readFile(source);if(createHash("sha256").update(bytes).digest("hex")!==auditedReturnTemplateHashes.pntV03)throw new Error("El PNT no coincide con la copia auditada.");
  await mkdir(dir,{recursive:true});await copyFile(source,path.join(dir,"GC-00-028-03 Devoluciones.docx"));console.log("PNT v03 instalado; instala también los anexos oficiales.");return;
 }
 const checked=await Promise.all(files.map(async([name,type,checksum])=>{
  const bytes=await readFile(path.join(source,name));
  if(createHash("sha256").update(bytes).digest("hex")!==checksum)throw new Error(`Checksum inesperado: ${name}`);
  return {name,type,checksum,bytes};
 }));
 const pnt=await readFile(path.join(source,"GC-00.028.03 DEV PRODUCTO_CSM_CG.docx"));
 if(createHash("sha256").update(pnt).digest("hex")!==auditedReturnTemplateHashes.pntV03)throw new Error("Checksum inesperado del PNT.");
 const db=new PrismaClient();
 try{await db.$transaction(async tx=>{
  for(const file of checked){
   const where={module_documentType_versionCode:{module:"RETURN" as const,documentType:file.type,versionCode:"03"}};
   const existing=await tx.templateVersion.findUnique({where});
   if(existing?.fileData&&existing.checksum!==file.checksum)throw new Error(`La versión 03 de ${file.type} ya contiene otro binario: no se sobrescribe un activo histórico.`);
   const data={fileName:file.name,fileData:new Uint8Array(file.bytes),fileSize:file.bytes.length,checksum:file.checksum,mimeType:file.name.endsWith("xlsx")?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"};
   await tx.templateVersion.upsert({where,update:data,create:{module:"RETURN",documentType:file.type,versionCode:"03",effectiveFrom:new Date("2026-05-26"),...data}});
  }
 });}finally{await db.$disconnect();}
 await mkdir(dir,{recursive:true});
 for(const file of checked)await copyFile(path.join(source,file.name),path.join(dir,file.name));
 await copyFile(path.join(source,"GC-00.028.03 DEV PRODUCTO_CSM_CG.docx"),path.join(dir,"GC-00-028-03 Devoluciones.docx"));
 console.log("PNT y Anexos III/IV/V/VI oficiales verificados e instalados; histórico conservado.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
