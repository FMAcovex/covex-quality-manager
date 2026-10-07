import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/db";
import { DocumentType } from "@prisma/client";
export const auditControlledAssets = [
  {name:"A3.03 INFORME AUDITORIA INTERNA.docx",type:DocumentType.AUDIT_INTERNAL_REPORT,version:"03",date:"2026-04-10",hash:"d461403cecfb8b6cfb601ad9e395e6f3d1f0247156570633b0e287ac2f87b7f9"},
  {name:"A4.03 CAPA PLAN.xlsx",type:DocumentType.AUDIT_CAPA_PLAN,version:"03",date:"2026-04-10",hash:"88d1a49e814cb3f035bc85c025ebefb2e5da6f7eb4da2d245d2b0deb9de32414"},
  {name:"A3. INFORME AUDITORIA_V04.docx",type:DocumentType.AUDIT_EXTERNAL_REPORT,version:"04",date:"2026-06-08",hash:"ed09292702a08c73a26a42d019e81c1d7d74ac63264b278dd6d6fa6e2acbc40d"},
  {name:"GC-00.034.04 Auditorías externas.docx",type:DocumentType.AUDIT_EXTERNAL_PLAN,version:"04",date:"2026-06-08",hash:"1c73fa4fbe06b42a797000ce0a95ccee034261a230ddc7602920ace17bcae6af"},
] as const;
async function main(){
 const dir=process.argv[2];if(!dir)throw new Error("Indica la carpeta con los cuatro binarios oficiales vigentes; no se admiten borradores/obsoletos.");
 const assets=await Promise.all(auditControlledAssets.map(async a=>{const b=await readFile(path.resolve(dir,a.name));if(createHash('sha256').update(b).digest('hex')!==a.hash)throw new Error(`SHA-256 no reconocido: ${a.name}. Revisa la nueva fuente antes de adaptar/activar el generador.`);return {a,b};}));
 await prisma.$transaction(async tx=>{for(const {a,b} of assets){
  const existing=await tx.templateVersion.findUnique({where:{module_documentType_versionCode:{module:'AUDIT',documentType:a.type,versionCode:a.version}}});
  if(existing&&existing.checksum!==a.hash)throw new Error(`No se sustituye la plantilla histórica ${a.type}/${a.version}.`);
  if(!existing)await tx.templateVersion.create({data:{module:'AUDIT',documentType:a.type,versionCode:a.version,effectiveFrom:new Date(a.date),fileName:a.name,fileData:b,fileSize:b.length,checksum:a.hash,mimeType:a.name.endsWith('xlsx')?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',isActive:true}});
 }});console.log("Plantillas Auditorías verificadas/instaladas. Plan externo: extracción del Anexo IV del PNT, sin plantilla inventada.");
}
main().finally(()=>prisma.$disconnect()).catch(e=>{console.error(e);process.exitCode=1;});
