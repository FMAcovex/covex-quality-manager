import { z } from "zod";
import { returnContext, returnApplicability, reintegrationRequested, generalReturnChecks, coldReturnChecks, validReturnDate } from "./rules";
import type { ReturnProductInput } from "@/modules/returns/types";

const typeSchema=z.enum(["COMMERCIAL","COMPLAINT","RECALL","EXPIRY","TRANSPORT","OTHER"]);
const productTypeSchema=z.enum(["API","INTERMEDIATE","MEDICINE","SUPPLEMENT","IMPORTED_PRODUCT","MEDICAL_DEVICE","COSMETIC","OTHER"]);
const decisionSchema=z.enum(["PENDING","ACCEPTED","REJECTED"]);
const statusSchema=z.enum(["DRAFT","OPEN","CLOSED"]);
const triSchema=z.enum(["YES","NO","NA"]);
const qualitySchema=z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);

function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"&&v.trim()?v.trim():null;}
function bool(fd:FormData,name:string){const v=text(fd,name);return (v==="true"||v==="on")?true:v==="false"?false:null;}
function en<T extends z.ZodTypeAny>(s:T,v:string|null){if(!v)return null;const r=s.safeParse(v);return r.success?r.data:null;}

function products(raw:string|null):ReturnProductInput[]{
  if(!raw)return[];
  try{
    const a=JSON.parse(raw);
    if(!Array.isArray(a))return[];
    return a.filter((x):x is Record<string,unknown>=>Boolean(x&&typeof x==="object")).map((x)=>({
      id:typeof x.id==="string"?x.id:undefined,
      departmentId:typeof x.departmentId==="string"?x.departmentId:"",
      productType:en(productTypeSchema,typeof x.productType==="string"?x.productType:null)??"OTHER",
      otherProductType:typeof x.otherProductType==="string"?x.otherProductType:"",
      productNameCode:typeof x.productNameCode==="string"?x.productNameCode.trim():"",
      format:typeof x.format==="string"?x.format.trim():"",
      lot:typeof x.lot==="string"?x.lot.trim():"",
      expiryReanalysis:typeof x.expiryReanalysis==="string"?x.expiryReanalysis.trim():"",
      quantity:typeof x.quantity==="string"?x.quantity.trim():"",
      unit:typeof x.unit==="string"?x.unit:"",
      netWeight:typeof x.netWeight==="string"?x.netWeight:"",
      grossWeight:typeof x.grossWeight==="string"?x.grossWeight:"",
      receptionObservations:typeof x.receptionObservations==="string"?x.receptionObservations:"",
      receivedBy:typeof x.receivedBy==="string"?x.receivedBy:"",
      receivedByDate:typeof x.receivedByDate==="string"?x.receivedByDate:"",
      verifiedBy:typeof x.verifiedBy==="string"?x.verifiedBy:"",
      verifiedByDate:typeof x.verifiedByDate==="string"?x.verifiedByDate:""
    }));
  }catch{ /* Entrada mal formada: se trata como vacía o no válida. */ return[];}
}

export function parseReturnForm(fd:FormData,existingNextFollowup?:string){
  const businessCode=text(fd,"businessCode");
  const departmentId=text(fd,"departmentId");
  const communicationDate=text(fd,"communicationDate");
  const createdByText=text(fd,"createdByText");
  const returnType=en(typeSchema,text(fd,"returnType"));
  const customerEntity=text(fd,"customerEntity");
  const ps=products(text(fd,"productsJson"));
  const decision=en(decisionSchema,text(fd,"decision"))??"PENDING";
  const status=en(statusSchema,text(fd,"status"))??"DRAFT";
  const context=returnContext({medicineFromWholesale:bool(fd,"medicineFromWholesale"),ambientPeriodRiskJustification:text(fd,"ambientPeriodRiskJustification"),destinationKind:text(fd,"destinationKind"),temperatureControlled:bool(fd,"temperatureControlled"),serializedMedicine:bool(fd,"serializedMedicine"),declarationRequired:bool(fd,"declarationRequired"),qcRequired:bool(fd,"qcRequired"),requiresFollowup:bool(fd,"requiresFollowup")});
  const applicability=returnApplicability(ps,text(fd,"conservationConditions"),context);
  const reintegration=reintegrationRequested(text(fd,"finalDestination"),context);
  const errors:string[]=[];
  const tri=(name:string)=>en(triSchema,text(fd,name));

  const requiredText=(name:string,message:string)=>{
    if(!text(fd,name))errors.push(message);
  };
  const requiredTri=(name:string,label:string)=>{
    if(!tri(name))errors.push(`${label} es obligatorio.`);
  };

  if(status!=="DRAFT"){
    if(!departmentId)errors.push("El área/almacén es obligatorio.");
    if(!communicationDate)errors.push("La fecha de comunicación es obligatoria.");
    requiredText("receivedAt","La fecha de recepción es obligatoria.");
    if(!createdByText)errors.push("Debe indicarse quién cumplimenta el expediente.");
    if(!returnType)errors.push("Debe seleccionarse el tipo de devolución.");
    if(!customerEntity)errors.push("Debe indicarse el cliente/entidad.");
    requiredText("country","El país es obligatorio.");
    requiredText("address","La dirección es obligatoria.");
    requiredText("conservationConditions","Las condiciones de conservación son obligatorias.");
    requiredText("reasonObservations","Las observaciones o incidencias son obligatorias.");
    requiredText("attachedDocumentation","La documentación anexada es obligatoria.");

    // An open investigation may have evaluation pending. The official checklist
    // is completed when reintegration is considered or the dossier is closed.
    if(reintegration||status==="CLOSED"){
      generalReturnChecks.forEach(name=>requiredTri(name,name));
      if(applicability.serialized){requiredTri("uniqueIdentifierActive","Identificador único / Data Matrix activo");requiredTri("tamperEvidenceIntact","Tamper Evidence intacto");}
      if(applicability.cold){if(applicability.medicine)requiredTri("coldChainWithinFortyEightHours","+2/+8 ºC dentro de 48 h");coldReturnChecks.forEach(name=>requiredTri(name,name));}
      else if(applicability.medicine&&!context.medicineFromWholesale)requiredTri("roomTemperatureWithinTenDays","+15/+25 ºC dentro de 10 días");
      if(context.declarationRequired||applicability.medicine&&reintegration||applicability.cold)requiredTri("customerDeclarationAvailable","Declaración cliente disponible");
      if(context.qcRequired||applicability.api&&reintegration)requiredTri("qcAssessmentCompleted","Evaluación Control de Calidad");
    }
    if(reintegration&&decision!=="PENDING"){
      requiredText("decisionDate","La reincorporación requiere fecha de decisión técnica.");
      if(decision!=="ACCEPTED")errors.push("La reincorporación requiere decisión Aceptada; aceptación no equivale a liberación.");
      const checks:string[]=[...generalReturnChecks];
      if(applicability.serialized)checks.push("uniqueIdentifierActive","tamperEvidenceIntact");
      if(applicability.cold){if(applicability.medicine)checks.push("coldChainWithinFortyEightHours");checks.push(...coldReturnChecks);}
      else if(applicability.medicine&&!context.medicineFromWholesale)checks.push("roomTemperatureWithinTenDays");
      if(context.declarationRequired||applicability.medicine||applicability.cold)checks.push("customerDeclarationAvailable");
      if(context.qcRequired||applicability.api)checks.push("qcAssessmentCompleted");
      checks.forEach(name=>{if(tri(name)!=="YES"&&!((name==="temperatureExcursionEvaluated"||name==="coldChainReturnSystemValidated")&&tri(name)==="NA")&&!(name==="roomTemperatureWithinTenDays"&&tri(name)==="NO"&&context.ambientPeriodRiskJustification))errors.push(`Reincorporación incompatible con ${name}: debe ser Sí.`);});
    }

    if(!ps.length){
      errors.push("Debe registrarse al menos un producto devuelto.");
    }else{
      ps.forEach((p,index)=>{
        const n=index+1;
        if(!p.productNameCode)errors.push(`Producto ${n}: producto / código es obligatorio.`);
        if(!p.format)errors.push(`Producto ${n}: formato es obligatorio.`);
        if(!p.lot)errors.push(`Producto ${n}: lote es obligatorio.`);
        if(!p.expiryReanalysis)errors.push(`Producto ${n}: caducidad / reanálisis es obligatorio.`);
        if(!p.quantity)errors.push(`Producto ${n}: cantidad es obligatoria.`);
      });
    }
  }

  if(status==="CLOSED"){
    if(decision==="PENDING")errors.push("Una devolución cerrada requiere decisión Aceptada o Rechazada.");
    requiredText("decisionDate","Una devolución cerrada requiere fecha de decisión.");
    requiredText("closedAt","Una devolución cerrada requiere fecha de cierre.");
    requiredText("finalDestination","Una devolución cerrada requiere destino final.");
    if(tri("traceabilityUpdated")!=="YES")errors.push("Una devolución cerrada requiere trazabilidad y reconciliación de cantidades confirmadas (Sí).");
    if(context.destinationKind==="DESTROY"||/destruc/i.test(text(fd,"finalDestination")??""))requiredText("destructionCertificate","El cierre con destrucción requiere certificado, justificante o registro equivalente.");
  }

  for(const name of ["communicationDate","receivedAt","decisionDate","closedAt","customerDeclarationSignedAt","nextFollowupDate"]){if(!validReturnDate(text(fd,name)))errors.push(`La fecha ${name} no es válida.`);}
  ps.forEach((p,i)=>{for(const name of ["receivedByDate","verifiedByDate"] as const)if(!validReturnDate(p[name]))errors.push(`Producto ${i+1}: la fecha ${name} no es válida.`);});
  if(status==="OPEN"&&text(fd,"nextFollowupDate")!==existingNextFollowup&&text(fd,"nextFollowupDate")&&!text(fd,"followupComment"))errors.push("Indica el comentario/responsable de la planificación del seguimiento.");
  if(status==="OPEN"&&context.requiresFollowup&&!text(fd,"nextFollowupDate")&&!existingNextFollowup)errors.push("Una devolución abierta que requiere seguimiento necesita próxima fecha.");
  return {errors,actor:text(fd,"modifiedByText")??createdByText??"Usuario no informado",values:{
    businessCode,departmentId,communicationDate,receivedAt:text(fd,"receivedAt"),createdByText,returnType,otherReturnType:text(fd,"otherReturnType"),
    customerEntity,country:text(fd,"country"),address:text(fd,"address"),relatedDocument:text(fd,"relatedDocument"),conservationConditions:text(fd,"conservationConditions"),
    deliveryNote:text(fd,"deliveryNote"),reasonObservations:text(fd,"reasonObservations"),attachedDocumentation:text(fd,"attachedDocumentation"),
    withinAcceptedReturnPeriod:tri("withinAcceptedReturnPeriod"),roomTemperatureWithinTenDays:tri("roomTemperatureWithinTenDays"),
    coldChainWithinFortyEightHours:tri("coldChainWithinFortyEightHours"),uniqueIdentifierActive:tri("uniqueIdentifierActive"),
    tamperEvidenceIntact:tri("tamperEvidenceIntact"),packagingIntegrityOk:tri("packagingIntegrityOk"),
    customerDeclarationAvailable:tri("customerDeclarationAvailable"),
    customerDeclarationSignatoryName:text(fd,"customerDeclarationSignatoryName"),customerDeclarationSignatoryRole:text(fd,"customerDeclarationSignatoryRole"),
    customerDeclarationSignedAt:text(fd,"customerDeclarationSignedAt"),customerDeclarationObservations:text(fd,"customerDeclarationObservations"),
    storageTransportConditionsOk:tri("storageTransportConditionsOk"),
    noUseDamageContamination:tri("noUseDamageContamination"),noRecallAlertBlock:tri("noRecallAlertBlock"),expiryAcceptable:tri("expiryAcceptable"),
    qcAssessmentCompleted:tri("qcAssessmentCompleted"),storageTemperatureRecord:tri("storageTemperatureRecord"),
    returnTransportTempEvidence:tri("returnTransportTempEvidence"),transportPackagingSuitable:tri("transportPackagingSuitable"),
    receiptTemperatureAcceptable:tri("receiptTemperatureAcceptable"),temperatureExcursionEvaluated:tri("temperatureExcursionEvaluated"),
    coldChainReturnSystemValidated:tri("coldChainReturnSystemValidated"),decision,finalDestination:text(fd,"finalDestination"),
    decisionObservations:text(fd,"decisionObservations"),qaApprovalName:text(fd,"qaApprovalName"),technicalApprovalName:text(fd,"technicalApprovalName"),
    decisionDate:text(fd,"decisionDate"),destructionManagedBy:text(fd,"destructionManagedBy"),destructionCertificate:text(fd,"destructionCertificate"),
    traceabilityUpdated:tri("traceabilityUpdated"),closedAt:text(fd,"closedAt"),status,internalObservations:text(fd,"internalObservations"),
    signedDocumentAvailable:bool(fd,"signedDocumentAvailable"),dataQualityStatus:en(qualitySchema,text(fd,"dataQualityStatus"))??"REVIEW_REQUIRED",
    context,nextFollowupDate:text(fd,"nextFollowupDate"),followupComment:text(fd,"followupComment"),products:ps,fromComplaintId:text(fd,"fromComplaintId"),changeReason:text(fd,"changeReason")
  }};
}
