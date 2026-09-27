import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Prisma,PrismaClient,QmsRecordType,DocumentType } from "@prisma/client";

const prisma=new PrismaClient();

async function main(){
 const suffix=String(Date.now());
 const deptCode=`H9-${suffix.slice(-6)}`;
 const catalogKey=`H9_CATALOG_${suffix}`;
 const parameterKey=`H9_PARAMETER_${suffix}`;
 const alertKey=`H9_ALERT_${suffix}`;
 const formVersionCode=`H9-${suffix}`;
 const templateVersionCode=`H9-${suffix}`;
 const bytes=Buffer.from("covex-hito-9-template-smoke");
 const checksum=createHash("sha256").update(bytes).digest("hex");

 let departmentId:string|null=null,catalogId:string|null=null,parameterId:string|null=null,alertId:string|null=null,formId:string|null=null,templateId:string|null=null;
 try{
  const department=await prisma.department.create({data:{code:deptCode,name:"Departamento temporal Hito 9",isActive:true}});
  departmentId=department.id;
  await prisma.department.update({where:{id:department.id},data:{isActive:false,validTo:new Date("2099-12-31")}});
  assert.equal((await prisma.department.findUniqueOrThrow({where:{id:department.id}})).isActive,false);

  const catalog=await prisma.lookupCatalog.create({data:{key:catalogKey,label:"Catálogo temporal",module:QmsRecordType.DEVIATION,items:{create:{key:"ONE",label:"Uno",sortOrder:10}}},include:{items:true}});
  catalogId=catalog.id;
  assert.equal(catalog.items.length,1);
  await prisma.lookupCatalogItem.update({where:{id:catalog.items[0].id},data:{isActive:false}});
  assert.equal((await prisma.lookupCatalogItem.findUniqueOrThrow({where:{id:catalog.items[0].id}})).isActive,false);

  const parameter=await prisma.appParameter.create({data:{scope:"SMOKE",key:parameterKey,label:"Parámetro temporal",valueType:"INTEGER",value:14}});
  parameterId=parameter.id;
  await prisma.appParameter.update({where:{id:parameter.id},data:{value:21}});
  const storedParameter=await prisma.appParameter.findUniqueOrThrow({where:{id:parameter.id}});
  assert.equal(storedParameter.value,21);

  const alert=await prisma.alertRule.create({data:{key:alertKey,module:QmsRecordType.CAPA,kind:"FOLLOWUP_DUE",label:"Regla temporal",leadDays:7,severity:"WARNING"}});
  alertId=alert.id;
  await prisma.alertRule.update({where:{id:alert.id},data:{leadDays:10,isActive:false}});
  const storedAlert=await prisma.alertRule.findUniqueOrThrow({where:{id:alert.id}});
  assert.equal(storedAlert.leadDays,10);
  assert.equal(storedAlert.isActive,false);

  const active=await prisma.formVersion.findFirstOrThrow({where:{module:QmsRecordType.DEVIATION,status:"ACTIVE",isActive:true},include:{fieldConfigs:true}});
  const clone=await prisma.formVersion.create({data:{module:QmsRecordType.DEVIATION,versionCode:formVersionCode,effectiveFrom:new Date("2099-12-30"),status:"DRAFT",isActive:false,notes:"Smoke Hito 9"}});
  formId=clone.id;
  await prisma.formFieldConfig.createMany({data:active.fieldConfigs.map(x=>({formVersionId:clone.id,fieldKey:x.fieldKey,label:x.label,sectionKey:x.sectionKey,sectionLabel:x.sectionLabel,sortOrder:x.sortOrder,kind:x.kind,valueType:x.valueType,required:x.required,listAvailable:x.listAvailable,listVisibleByDefault:x.listVisibleByDefault,filterable:x.filterable,simpleExport:x.simpleExport,officialAnnexField:x.officialAnnexField,editableDefinition:x.editableDefinition,options:x.options===null?undefined:x.options as Prisma.InputJsonValue}))});
  assert.equal(await prisma.formFieldConfig.count({where:{formVersionId:clone.id}}),active.fieldConfigs.length);

  const template=await prisma.templateVersion.create({data:{module:QmsRecordType.DEVIATION,documentType:DocumentType.DEVIATION_ANNEX_III,versionCode:templateVersionCode,effectiveFrom:new Date("2099-12-30"),isActive:false,fileName:"smoke.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",fileData:bytes,fileSize:bytes.length,checksum}});
  templateId=template.id;
  const storedTemplate=await prisma.templateVersion.findUniqueOrThrow({where:{id:template.id},select:{fileData:true,checksum:true,fileSize:true}});
  assert.equal(Buffer.from(storedTemplate.fileData??[]).toString("utf8"),bytes.toString("utf8"));
  assert.equal(storedTemplate.checksum,checksum);
  assert.equal(storedTemplate.fileSize,bytes.length);

  await prisma.configurationChange.create({data:{entityType:"Smoke",entityKey:suffix,action:"TEST",changedByText:"CI",reason:"Hito 9 smoke"}});
  assert.ok(await prisma.configurationChange.findFirst({where:{entityType:"Smoke",entityKey:suffix}}));

  console.log("Hito 9 administration PostgreSQL smoke test passed.");
 } finally {
  await prisma.configurationChange.deleteMany({where:{entityType:"Smoke",entityKey:suffix}});
  if(templateId)await prisma.templateVersion.delete({where:{id:templateId}}).catch(()=>undefined);
  if(formId)await prisma.formVersion.delete({where:{id:formId}}).catch(()=>undefined);
  if(alertId)await prisma.alertRule.delete({where:{id:alertId}}).catch(()=>undefined);
  if(parameterId)await prisma.appParameter.delete({where:{id:parameterId}}).catch(()=>undefined);
  if(catalogId)await prisma.lookupCatalog.delete({where:{id:catalogId}}).catch(()=>undefined);
  if(departmentId)await prisma.department.delete({where:{id:departmentId}}).catch(()=>undefined);
 }
}

main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
