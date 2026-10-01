import { z } from "zod";
import type { ReturnProductInput } from "@/modules/returns/types";

const typeSchema=z.enum(["COMMERCIAL","COMPLAINT","RECALL","EXPIRY","TRANSPORT","OTHER"]);
const productTypeSchema=z.enum(["API","INTERMEDIATE","MEDICINE","SUPPLEMENT","IMPORTED_PRODUCT","MEDICAL_DEVICE","COSMETIC","OTHER"]);
const decisionSchema=z.enum(["PENDING","ACCEPTED","REJECTED"]);
const statusSchema=z.enum(["DRAFT","OPEN","CLOSED"]);
const triSchema=z.enum(["YES","NO","NA"]);
const qualitySchema=z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);

function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"&&v.trim()?v.trim():null;}
function bool(fd:FormData,name:string){const v=text(fd,name);return v==="true"?true:v==="false"?false:null;}
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
  }catch{return[];}
}

export function parseReturnForm(fd:FormData){
  const businessCode=text(fd,"businessCode");
  const departmentId=text(fd,"departmentId");
  const communicationDate=text(fd,"communicationDate");
  const createdByText=text(fd,"createdByText");
  const returnType=en(typeSchema,text(fd,"returnType"));
  const customerEntity=text(fd,"customerEntity");
  const ps=products(text(fd,"productsJson"));
  const decision=en(decisionSchema,text(fd,"decision"))??"PENDING";
  const status=en(statusSchema,text(fd,"status"))??"DRAFT";
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

    requiredTri("withinAcceptedReturnPeriod","Plazo aceptable de devolución");
    requiredTri("roomTemperatureWithinTenDays","+15/+25 ºC dentro de 10 días");
    requiredTri("coldChainWithinFortyEightHours","+2/+8 ºC dentro de 48 h");
    requiredTri("uniqueIdentifierActive","Identificador único / Data Matrix activo");
    requiredTri("tamperEvidenceIntact","Tamper Evidence intacto");
    requiredTri("packagingIntegrityOk","Envases íntegros");
    requiredTri("customerDeclarationAvailable","Declaración cliente disponible");
    requiredTri("storageTransportConditionsOk","Almacenamiento/transporte conforme");
    requiredTri("noUseDamageContamination","Sin uso/daño/contaminación");
    requiredTri("noRecallAlertBlock","Sin retirada/alerta/bloqueo");
    requiredTri("expiryAcceptable","Caducidad/reanálisis aceptable");
    requiredTri("qcAssessmentCompleted","Evaluación Control de Calidad");

    requiredTri("storageTemperatureRecord","Registro de temperatura de almacenamiento");
    requiredTri("returnTransportTempEvidence","Evidencia de temperatura en transporte de retorno");
    requiredTri("transportPackagingSuitable","Embalaje de transporte conforme");
    requiredTri("receiptTemperatureAcceptable","Temperatura de recepción aceptable");
    requiredTri("temperatureExcursionEvaluated","Excursión evaluada/documentada");
    requiredTri("coldChainReturnSystemValidated","Sistema de devolución de termolábiles validado");

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
    if(!tri("traceabilityUpdated"))errors.push("Una devolución cerrada requiere informar la trazabilidad actualizada.");
  }

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
    products:ps,fromComplaintId:text(fd,"fromComplaintId"),changeReason:text(fd,"changeReason")
  }};
}
