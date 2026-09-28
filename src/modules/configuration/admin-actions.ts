"use server";

import { createHash } from "node:crypto";

import { AlertRuleKind,AlertSeverity,DocumentType,FormVersionStatus,ParameterValueType,Prisma,QmsRecordType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
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
