"use server";

import { createHash } from "node:crypto";

import { AlertRuleKind,AlertSeverity,DocumentType,FormVersionStatus,ParameterValueType,Prisma,QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { readZip } from "@/lib/ooxml/zip";
import { isAllowedDocumentType } from "@/modules/configuration/admin-domain";

function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"?v.trim():"";}
function bool(fd:FormData,name:string){return text(fd,name)==="true";}
function dateOrNull(v:string){return v?new Date(v):null;}
function actor(fd:FormData){return text(fd,"actor")||process.env.DEFAULT_ACTOR_NAME||"Usuario demo";}
function reason(fd:FormData){return text(fd,"reason")||null;}
function json(value:unknown){return JSON.parse(JSON.stringify(value??null));}

async function logChange(entityType:string,entityKey:string,action:string,oldValue:unknown,newValue:unknown,fd:FormData){
  await prisma.configurationChange.create({data:{entityType,entityKey,action,oldValue:oldValue===undefined?undefined:json(oldValue),newValue:newValue===undefined?undefined:json(newValue),changedByText:actor(fd),reason:reason(fd)}});
  revalidatePath("/settings/history");
  revalidatePath("/settings");
}

export async function createDepartmentAction(fd:FormData){
  const code=text(fd,"code").toUpperCase(),name=text(fd,"name");
  if(!code||!name)throw new Error("Código y nombre son obligatorios.");
  const created=await prisma.department.create({data:{code,name,isActive:true,validFrom:dateOrNull(text(fd,"validFrom"))}});
  await logChange("Department",code,"CREATE",null,created,fd);
  revalidatePath("/settings/catalogs");
}

export async function updateDepartmentAction(id:string,fd:FormData){
  const current=await prisma.department.findUniqueOrThrow({where:{id}});
  const updated=await prisma.department.update({where:{id},data:{name:text(fd,"name")||current.name,isActive:bool(fd,"isActive"),validFrom:dateOrNull(text(fd,"validFrom")),validTo:dateOrNull(text(fd,"validTo"))}});
  await logChange("Department",current.code,"UPDATE",current,updated,fd);
  revalidatePath("/settings/catalogs");
}

export async function createCatalogAction(fd:FormData){
  const key=text(fd,"key").toUpperCase().replace(/[^A-Z0-9_]/g,"_"),label=text(fd,"label");
  if(!key||!label)throw new Error("Clave y nombre son obligatorios.");
  const rawModule=text(fd,"module");
  const moduleValue=Object.values(QmsRecordType).includes(rawModule as QmsRecordType)?rawModule as QmsRecordType:null;
  const created=await prisma.lookupCatalog.create({data:{key,label,module:moduleValue,description:text(fd,"description")||null,isActive:true}});
  await logChange("LookupCatalog",key,"CREATE",null,created,fd);
  revalidatePath("/settings/catalogs");
}

export async function updateCatalogAction(id:string,fd:FormData){
  const current=await prisma.lookupCatalog.findUniqueOrThrow({where:{id}});
  const updated=await prisma.lookupCatalog.update({where:{id},data:{label:text(fd,"label")||current.label,description:text(fd,"description")||null,isActive:bool(fd,"isActive")}});
  await logChange("LookupCatalog",current.key,"UPDATE",current,updated,fd);
  revalidatePath("/settings/catalogs");
}

export async function createCatalogItemAction(catalogId:string,fd:FormData){
  const catalog=await prisma.lookupCatalog.findUniqueOrThrow({where:{id:catalogId}});
  const key=text(fd,"key").toUpperCase().replace(/[^A-Z0-9_]/g,"_"),label=text(fd,"label");
  if(!key||!label)throw new Error("Clave y etiqueta son obligatorias.");
  const created=await prisma.lookupCatalogItem.create({data:{catalogId,key,label,sortOrder:Number(text(fd,"sortOrder")||"0"),isActive:true,validFrom:dateOrNull(text(fd,"validFrom")),notes:text(fd,"notes")||null}});
  await logChange("LookupCatalogItem",`${catalog.key}:${key}`,"CREATE",null,created,fd);
  revalidatePath("/settings/catalogs");
}

export async function updateCatalogItemAction(id:string,fd:FormData){
  const current=await prisma.lookupCatalogItem.findUniqueOrThrow({where:{id},include:{catalog:true}});
  const updated=await prisma.lookupCatalogItem.update({where:{id},data:{label:text(fd,"label")||current.label,sortOrder:Number(text(fd,"sortOrder")||String(current.sortOrder)),isActive:bool(fd,"isActive"),validFrom:dateOrNull(text(fd,"validFrom")),validTo:dateOrNull(text(fd,"validTo")),notes:text(fd,"notes")||null}});
  await logChange("LookupCatalogItem",`${current.catalog.key}:${current.key}`,"UPDATE",current,updated,fd);
  revalidatePath("/settings/catalogs");
}

export async function cloneFormVersionAction(formId:string,fd:FormData){
  const source=await prisma.formVersion.findUniqueOrThrow({where:{id:formId},include:{fieldConfigs:true}});
  const versionCode=text(fd,"versionCode"),effectiveFrom=text(fd,"effectiveFrom");
  if(!versionCode||!effectiveFrom)throw new Error("Versión y fecha de vigencia son obligatorias.");
  const created=await prisma.$transaction(async tx=>{
    const form=await tx.formVersion.create({data:{module:source.module,versionCode,effectiveFrom:new Date(effectiveFrom),status:FormVersionStatus.DRAFT,isActive:false,notes:text(fd,"notes")||`Clonada desde ${source.versionCode}`}});
    if(source.fieldConfigs.length)await tx.formFieldConfig.createMany({data:source.fieldConfigs.map(x=>({formVersionId:form.id,fieldKey:x.fieldKey,label:x.label,sectionKey:x.sectionKey,sectionLabel:x.sectionLabel,sortOrder:x.sortOrder,kind:x.kind,valueType:x.valueType,required:x.required,listAvailable:x.listAvailable,listVisibleByDefault:x.listVisibleByDefault,filterable:x.filterable,simpleExport:x.simpleExport,officialAnnexField:x.officialAnnexField,editableDefinition:x.editableDefinition,options:x.options===null?undefined:x.options as Prisma.InputJsonValue}))});
    return form;
  });
  await logChange("FormVersion",`${source.module}:${versionCode}`,"CLONE",source,created,fd);
  revalidatePath("/settings/versions");
}

export async function activateFormVersionAction(id:string,fd:FormData){
  const target=await prisma.formVersion.findUniqueOrThrow({where:{id}});
  if(target.status!=="DRAFT")throw new Error("Solo puede activarse una versión en borrador.");
  const currentActive=await prisma.formVersion.findFirst({where:{module:target.module,status:"ACTIVE",isActive:true,id:{not:id}},orderBy:{effectiveFrom:"desc"}});
  if(currentActive&&target.effectiveFrom<=currentActive.effectiveFrom)throw new Error("La nueva versión debe tener una vigencia posterior a la versión activa.");
  await prisma.$transaction(async tx=>{
    const active=await tx.formVersion.findMany({where:{module:target.module,status:"ACTIVE",isActive:true,id:{not:id}}});
    for(const old of active)await tx.formVersion.update({where:{id:old.id},data:{status:"RETIRED",isActive:false,effectiveTo:new Date(target.effectiveFrom.getTime()-86400000)}});
    await tx.formVersion.update({where:{id},data:{status:"ACTIVE",isActive:true,effectiveTo:null}});
  });
  const updated=await prisma.formVersion.findUniqueOrThrow({where:{id}});
  await logChange("FormVersion",`${target.module}:${target.versionCode}`,"ACTIVATE",target,updated,fd);
  revalidatePath("/settings/versions");
}

const TEMPLATE_PACKAGE_MANIFEST=[
  {module:QmsRecordType.DEVIATION,documentType:DocumentType.DEVIATION_ANNEX_III,versionCode:"06",effectiveFrom:"2026-03-12",suffix:"DESVIACIONES/Anexo III Informe Desviaciones 06.docx",sha:"8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43"},
  {module:QmsRecordType.DEVIATION,documentType:DocumentType.DEVIATION_ANNEX_V,versionCode:"06",effectiveFrom:"2026-03-12",suffix:"DESVIACIONES/Anexo V.xlsx",sha:"1f92410bc94e2037fe632450ce766b3ce5d44c4f55b8868056bad73c882c03f2"},
  {module:QmsRecordType.CAPA,documentType:DocumentType.CAPA_ANNEX_III,versionCode:"05",effectiveFrom:"2026-03-11",suffix:"CAPAS/Anexo III INFORME CAPA 05.docx",sha:"73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540"},
  {module:QmsRecordType.CAPA,documentType:DocumentType.CAPA_ANNEX_IV,versionCode:"05",effectiveFrom:"2026-03-11",suffix:"CAPAS/Anexo IV LISTADO CAPA 05 oficial.xlsx",sha:"47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3"},
  {module:QmsRecordType.CHANGE_CONTROL,documentType:DocumentType.CHANGE_ANNEX_III,versionCode:"03",effectiveFrom:"2026-05-05",suffix:"CONTROLES DE CAMBIO/Anexo III_PNT GC003.03_Solicitud.docx",sha:"a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f"},
  {module:QmsRecordType.CHANGE_CONTROL,documentType:DocumentType.CHANGE_ANNEX_IV,versionCode:"03",effectiveFrom:"2026-05-05",suffix:"CONTROLES DE CAMBIO/Anexo IV_PNT GC003.03_Dictamen.docx",sha:"742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60"},
  {module:QmsRecordType.CHANGE_CONTROL,documentType:DocumentType.CHANGE_ANNEX_V,versionCode:"03",effectiveFrom:"2026-05-05",suffix:"CONTROLES DE CAMBIO/Anexo V_PNT GC003.03_Informe .docx",sha:"3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4"},
  {module:QmsRecordType.CHANGE_CONTROL,documentType:DocumentType.CHANGE_ANNEX_VII,versionCode:"03",effectiveFrom:"2026-05-05",suffix:"CONTROLES DE CAMBIO/Anexo VII_PNT GC003.03_Listado seguimiento .xlsx",sha:"b65671cdd652f104f4038c65e07c025b5c7374dee4b683d74fbeef55f12bc8eb"},
  {module:QmsRecordType.COMPLAINT,documentType:DocumentType.COMPLAINT_ANNEX_III,versionCode:"03",effectiveFrom:"2026-09-28",suffix:"PNT RECLAMACIONES/Anexo III 02 INFORME RECLAMACION.docx",sha:"764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde"},
  {module:QmsRecordType.COMPLAINT,documentType:DocumentType.COMPLAINT_ANNEX_V,versionCode:"03",effectiveFrom:"2026-09-28",suffix:"PNT RECLAMACIONES/Anexo V 02 LISTADO DE RECLAMACIONES.xlsx",sha:"8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83"},
  {module:QmsRecordType.RETURN,documentType:DocumentType.RETURN_ANNEX_III,versionCode:"03",effectiveFrom:"2026-05-26",suffix:"DEVOLUCIONES/A3 FORMULARIO DEV 03.docx",sha:"9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4"},
  {module:QmsRecordType.RETURN,documentType:DocumentType.RETURN_ANNEX_IV,versionCode:"03",effectiveFrom:"2026-05-26",suffix:"DEVOLUCIONES/GC-00.028.03 DEV PRODUCTO_CSM_CG.docx",sha:"7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a"},
  {module:QmsRecordType.RETURN,documentType:DocumentType.RETURN_ANNEX_V,versionCode:"03",effectiveFrom:"2026-05-26",suffix:"DEVOLUCIONES/GC-00.028.03 DEV PRODUCTO_CSM_CG.docx",sha:"7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a"},
  {module:QmsRecordType.RETURN,documentType:DocumentType.RETURN_ANNEX_VI,versionCode:"03",effectiveFrom:"2026-05-26",suffix:"DEVOLUCIONES/A6 LISTADO DEV 03.xlsx",sha:"fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64"},
] as const;

export async function importTemplatePackageAction(fd:FormData){
 const file=fd.get("package");
 if(!(file instanceof File)||file.size===0)throw new Error("Adjunta el ZIP de plantillas.");
 if(file.size>15*1024*1024)throw new Error("El paquete supera el límite de 15 MB.");
 const entries=readZip(Buffer.from(await file.arrayBuffer())).filter(x=>!x.name.endsWith("/"));
 const normalized=(value:string)=>value.replaceAll("\\","/").normalize("NFC").toLocaleLowerCase("es-ES");
 const imported:string[]=[];
 await prisma.$transaction(async tx=>{
  for(const item of TEMPLATE_PACKAGE_MANIFEST){
   const targetSuffix=normalized(item.suffix);
   const entry=entries.find(x=>normalized(x.name).endsWith(targetSuffix));
   if(!entry)throw new Error(`Falta en el ZIP: ${item.suffix}`);
   const checksum=createHash("sha256").update(entry.data).digest("hex");
   if(checksum!==item.sha)throw new Error(`La copia de ${item.suffix} no coincide con la plantilla auditada.`);
   const fileName=entry.name.split("/").pop()||item.suffix;
   const mimeType=fileName.toLowerCase().endsWith(".xlsx")
     ?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
     :"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
   await tx.templateVersion.upsert({
    where:{module_documentType_versionCode:{module:item.module,documentType:item.documentType,versionCode:item.versionCode}},
    update:{fileName,mimeType,fileData:new Uint8Array(entry.data),fileSize:entry.data.length,checksum,filePath:null},
    create:{module:item.module,documentType:item.documentType,versionCode:item.versionCode,effectiveFrom:new Date(item.effectiveFrom),isActive:true,fileName,mimeType,fileData:new Uint8Array(entry.data),fileSize:entry.data.length,checksum},
   });
   imported.push(`${item.module}:${item.documentType}:${item.versionCode}`);
  }
 });
 await logChange("TemplatePackage","ANEXOS PARA APP","IMPORT",null,{files:imported.length,templates:imported},fd);
 revalidatePath("/settings/versions");
}

export async function registerTemplateVersionAction(fd:FormData){
  const moduleRaw=text(fd,"module"),docRaw=text(fd,"documentType");
  if(!Object.values(QmsRecordType).includes(moduleRaw as QmsRecordType))throw new Error("Módulo no válido.");
  if(!Object.values(DocumentType).includes(docRaw as DocumentType))throw new Error("Tipo documental no válido.");
  const moduleValue=moduleRaw as QmsRecordType,documentTypeValue=docRaw as DocumentType;
  if(!isAllowedDocumentType(moduleValue,documentTypeValue))throw new Error("El tipo documental no pertenece al módulo seleccionado.");
  const versionCode=text(fd,"versionCode"),effectiveFrom=text(fd,"effectiveFrom");
  if(!versionCode||!effectiveFrom)throw new Error("Versión y vigencia son obligatorias.");
  const fileValue=fd.get("file");
  let fileName:string|null=null,mimeType:string|null=null,fileData:Uint8Array<ArrayBuffer>|null=null,fileSize:number|null=null,checksum:string|null=text(fd,"checksum")||null;
  if(fileValue instanceof File&&fileValue.size>0){
    if(fileValue.size>15*1024*1024)throw new Error("La plantilla supera el límite de 15 MB.");
    const ext=fileValue.name.toLowerCase().split(".").pop();
    if(ext!=="docx"&&ext!=="xlsx")throw new Error("Solo se admiten plantillas DOCX o XLSX.");
    const bytes=new Uint8Array(await fileValue.arrayBuffer());
    fileName=fileValue.name;mimeType=fileValue.type||null;fileData=bytes;fileSize=fileValue.size;
    checksum=createHash("sha256").update(bytes).digest("hex");
  }
  const filePath=text(fd,"filePath")||null;
  if(!fileData&&!filePath)throw new Error("Adjunta el archivo controlado o informa una ruta gestionada técnicamente.");
  if(filePath&&(!checksum||!/^[a-fA-F0-9]{64}$/.test(checksum)))throw new Error("Una plantilla gestionada por ruta requiere SHA-256 válido.");
  const created=await prisma.templateVersion.create({data:{module:moduleValue,documentType:documentTypeValue,versionCode,effectiveFrom:new Date(effectiveFrom),filePath,fileName,mimeType,fileData,fileSize,checksum,isActive:false}});
  await logChange("TemplateVersion",`${moduleRaw}:${docRaw}:${versionCode}`,"REGISTER",null,{...created,fileData:fileData?"[binary]":null},fd);
  revalidatePath("/settings/versions");
}

export async function activateTemplateVersionAction(id:string,fd:FormData){
  const target=await prisma.templateVersion.findUniqueOrThrow({where:{id}});
  const currentActive=await prisma.templateVersion.findFirst({where:{module:target.module,documentType:target.documentType,isActive:true,id:{not:id}},orderBy:{effectiveFrom:"desc"}});
  if(currentActive&&target.effectiveFrom<=currentActive.effectiveFrom)throw new Error("La nueva plantilla debe tener una vigencia posterior a la plantilla activa.");
  await prisma.$transaction(async tx=>{
    const active=await tx.templateVersion.findMany({where:{module:target.module,documentType:target.documentType,isActive:true,id:{not:id}}});
    for(const old of active)await tx.templateVersion.update({where:{id:old.id},data:{isActive:false,effectiveTo:new Date(target.effectiveFrom.getTime()-86400000)}});
    await tx.templateVersion.update({where:{id},data:{isActive:true,effectiveTo:null}});
  });
  const updated=await prisma.templateVersion.findUniqueOrThrow({where:{id}});
  const summary=(v:typeof target)=>({id:v.id,module:v.module,documentType:v.documentType,versionCode:v.versionCode,effectiveFrom:v.effectiveFrom,effectiveTo:v.effectiveTo,isActive:v.isActive,fileName:v.fileName,fileSize:v.fileSize,checksum:v.checksum});
  await logChange("TemplateVersion",`${target.module}:${target.documentType}:${target.versionCode}`,"ACTIVATE",summary(target),summary(updated),fd);
  revalidatePath("/settings/versions");
}

function parseParameter(type:ParameterValueType,raw:string){
  if(type==="TEXT")return raw;
  if(type==="INTEGER"){const n=Number(raw);if(!Number.isInteger(n))throw new Error("El valor debe ser un número entero.");return n;}
  if(type==="BOOLEAN"){if(raw!=="true"&&raw!=="false")throw new Error("El valor debe ser true o false.");return raw==="true";}
  try{return JSON.parse(raw);}catch{throw new Error("JSON no válido.");}
}

export async function updateParameterAction(id:string,fd:FormData){
  const current=await prisma.appParameter.findUniqueOrThrow({where:{id}});
  const value=parseParameter(current.valueType,text(fd,"value"));
  const updated=await prisma.appParameter.update({where:{id},data:{value:json(value),isActive:bool(fd,"isActive")}});
  await logChange("AppParameter",`${current.scope}:${current.key}`,"UPDATE",current,updated,fd);
  revalidatePath("/settings/parameters");
}

export async function updateAlertRuleAction(id:string,fd:FormData){
  const current=await prisma.alertRule.findUniqueOrThrow({where:{id}});
  const leadDays=Number(text(fd,"leadDays"));
  if(!Number.isInteger(leadDays)||leadDays<0||leadDays>365)throw new Error("Los días de preaviso deben estar entre 0 y 365.");
  const severityRaw=text(fd,"severity"),kindRaw=text(fd,"kind");
  const severity=Object.values(AlertSeverity).includes(severityRaw as AlertSeverity)?severityRaw as AlertSeverity:current.severity;
  const kind=Object.values(AlertRuleKind).includes(kindRaw as AlertRuleKind)?kindRaw as AlertRuleKind:current.kind;
  const updated=await prisma.alertRule.update({where:{id},data:{leadDays,severity,kind,isActive:bool(fd,"isActive")}});
  await logChange("AlertRule",current.key,"UPDATE",current,updated,fd);
  revalidatePath("/settings/alerts");
}


export async function updateFormFieldConfigAction(id:string,fd:FormData){
  const current=await prisma.formFieldConfig.findUniqueOrThrow({where:{id},include:{formVersion:true}});
  if(current.formVersion.status!=="DRAFT")throw new Error("Solo pueden editarse campos de una versión en borrador.");
  const updated=await prisma.formFieldConfig.update({
    where:{id},
    data:{
      label:text(fd,"label")||current.label,
      sectionLabel:text(fd,"sectionLabel")||current.sectionLabel,
      sortOrder:Number(text(fd,"sortOrder")||String(current.sortOrder)),
      listAvailable:bool(fd,"listAvailable"),
      listVisibleByDefault:bool(fd,"listVisibleByDefault"),
      filterable:bool(fd,"filterable"),
      simpleExport:bool(fd,"simpleExport"),
    },
  });
  await logChange("FormFieldConfig",`${current.formVersion.module}:${current.formVersion.versionCode}:${current.fieldKey}`,"UPDATE",current,updated,fd);
  revalidatePath("/settings/versions");
  revalidatePath(`/settings/versions/${current.formVersionId}`);
}
