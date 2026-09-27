import { z } from "zod";
import type { ReturnProductInput } from "@/modules/returns/types";
const typeSchema=z.enum(["COMMERCIAL","COMPLAINT","RECALL","EXPIRY","TRANSPORT","OTHER"]);
const productTypeSchema=z.enum(["API","INTERMEDIATE","MEDICINE","SUPPLEMENT","IMPORTED_PRODUCT","MEDICAL_DEVICE","COSMETIC","OTHER"]);
const decisionSchema=z.enum(["PENDING","ACCEPTED","REJECTED"]);
const statusSchema=z.enum(["OPEN","CLOSED"]);
const triSchema=z.enum(["YES","NO","NA"]);
const qualitySchema=z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);
function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"&&v.trim()?v.trim():null;}
function bool(fd:FormData,name:string){const v=text(fd,name);return v==="true"?true:v==="false"?false:null;}
function en<T extends z.ZodTypeAny>(s:T,v:string|null){if(!v)return null;const r=s.safeParse(v);return r.success?r.data:null;}
function products(raw:string|null):ReturnProductInput[]{if(!raw)return[];try{const a=JSON.parse(raw);if(!Array.isArray(a))return[];return a.map((x:any)=>({
id:typeof x.id==="string"?x.id:undefined,departmentId:typeof x.departmentId==="string"?x.departmentId:"",
productType:en(productTypeSchema,typeof x.productType==="string"?x.productType:null)??"OTHER",otherProductType:typeof x.otherProductType==="string"?x.otherProductType:"",
productNameCode:typeof x.productNameCode==="string"?x.productNameCode.trim():"",format:typeof x.format==="string"?x.format:"",lot:typeof x.lot==="string"?x.lot:"",
expiryReanalysis:typeof x.expiryReanalysis==="string"?x.expiryReanalysis:"",quantity:typeof x.quantity==="string"?x.quantity:"",unit:typeof x.unit==="string"?x.unit:"",
netWeight:typeof x.netWeight==="string"?x.netWeight:"",grossWeight:typeof x.grossWeight==="string"?x.grossWeight:"",receptionObservations:typeof x.receptionObservations==="string"?x.receptionObservations:"",
receivedBy:typeof x.receivedBy==="string"?x.receivedBy:"",verifiedBy:typeof x.verifiedBy==="string"?x.verifiedBy:""
})).filter(x=>x.productNameCode);}catch{return[];}}
export function parseReturnForm(fd:FormData){
 const businessCode=text(fd,"businessCode"),departmentId=text(fd,"departmentId"),communicationDate=text(fd,"communicationDate"),
 createdByText=text(fd,"createdByText"),returnType=en(typeSchema,text(fd,"returnType")),customerEntity=text(fd,"customerEntity"),
 ps=products(text(fd,"productsJson")),decision=en(decisionSchema,text(fd,"decision"))??"PENDING",status=en(statusSchema,text(fd,"status"))??"OPEN";
 const errors:string[]=[];
 if(!businessCode)errors.push("La codificación es obligatoria.");
 if(!departmentId)errors.push("El área/almacén es obligatorio.");
 if(!communicationDate)errors.push("La fecha de comunicación es obligatoria.");
 if(!createdByText)errors.push("Debe indicarse quién cumplimenta el expediente.");
 if(!returnType)errors.push("Debe seleccionarse el tipo de devolución.");
 if(returnType==="OTHER"&&!text(fd,"otherReturnType"))errors.push("Debe especificarse el otro tipo de devolución.");
 if(!customerEntity)errors.push("Debe indicarse el cliente/entidad.");
 if(!ps.length)errors.push("Debe registrarse al menos un producto devuelto.");
 if(status==="CLOSED"){
   if(decision==="PENDING")errors.push("Una devolución cerrada requiere decisión Aceptada o Rechazada.");
   if(!text(fd,"closedAt"))errors.push("Una devolución cerrada requiere fecha de cierre.");
   if(!text(fd,"finalDestination"))errors.push("Una devolución cerrada requiere destino final.");
 }
 const tri=(name:string)=>en(triSchema,text(fd,name));
 return {errors,actor:text(fd,"modifiedByText")??createdByText??"Usuario no informado",values:{
 businessCode,departmentId,communicationDate,receivedAt:text(fd,"receivedAt"),createdByText,returnType,otherReturnType:text(fd,"otherReturnType"),
 customerEntity,country:text(fd,"country"),address:text(fd,"address"),relatedDocument:text(fd,"relatedDocument"),conservationConditions:text(fd,"conservationConditions"),
 deliveryNote:text(fd,"deliveryNote"),reasonObservations:text(fd,"reasonObservations"),attachedDocumentation:text(fd,"attachedDocumentation"),
 withinAcceptedReturnPeriod:tri("withinAcceptedReturnPeriod"),roomTemperatureWithinTenDays:tri("roomTemperatureWithinTenDays"),
 coldChainWithinFortyEightHours:tri("coldChainWithinFortyEightHours"),uniqueIdentifierActive:tri("uniqueIdentifierActive"),
 tamperEvidenceIntact:tri("tamperEvidenceIntact"),packagingIntegrityOk:tri("packagingIntegrityOk"),
 customerDeclarationAvailable:tri("customerDeclarationAvailable"),storageTransportConditionsOk:tri("storageTransportConditionsOk"),
 noUseDamageContamination:tri("noUseDamageContamination"),noRecallAlertBlock:tri("noRecallAlertBlock"),expiryAcceptable:tri("expiryAcceptable"),
 qcAssessmentCompleted:tri("qcAssessmentCompleted"),storageTemperatureRecord:tri("storageTemperatureRecord"),
 returnTransportTempEvidence:tri("returnTransportTempEvidence"),transportPackagingSuitable:tri("transportPackagingSuitable"),
 receiptTemperatureAcceptable:tri("receiptTemperatureAcceptable"),temperatureExcursionEvaluated:tri("temperatureExcursionEvaluated"),
 coldChainReturnSystemValidated:tri("coldChainReturnSystemValidated"),decision,finalDestination:text(fd,"finalDestination"),
 decisionObservations:text(fd,"decisionObservations"),qaApprovalName:text(fd,"qaApprovalName"),technicalApprovalName:text(fd,"technicalApprovalName"),
 decisionDate:text(fd,"decisionDate"),destructionManagedBy:text(fd,"destructionManagedBy"),destructionCertificate:text(fd,"destructionCertificate"),
 traceabilityUpdated:tri("traceabilityUpdated"),closedAt:text(fd,"closedAt"),status,internalObservations:text(fd,"internalObservations"),
 signedDocumentAvailable:bool(fd,"signedDocumentAvailable"),dataQualityStatus:en(qualitySchema,text(fd,"dataQualityStatus"))??"REVIEW_REQUIRED",
 products:ps,changeReason:text(fd,"changeReason")
 }};
}
