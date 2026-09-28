import { z } from "zod";

const typeSchema=z.enum(["PROVIDER","CUSTOMER"]);
const classificationSchema=z.enum(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"]);
const resultSchema=z.enum(["PROCEDENT","NOT_PROCEDENT","INCONCLUSIVE","NOT_ATTRIBUTABLE_TO_COVEX"]);
const statusSchema=z.enum(["OPEN","CLOSED"]);
const efficacySchema=z.enum(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"]);
const qualitySchema=z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);
const triSchema=z.enum(["YES","NO","NA"]);
const capaActionSchema=z.enum(["CORRECTIVE","PREVENTIVE"]);
const resolutionSchema=z.enum([
"RETURN","CORRECTIVE_ACTION","PREVENTIVE_ACTION","IMMEDIATE_ACTION","RECALL","CREDIT","REPLACEMENT","REJECT","REPROCESS","DISPOSE","KEEP_AS_IS","SUPPLIER_INVESTIGATION","SUPPLIER_EVALUATION","OPEN_DEVIATION","OPEN_CAPA","OPEN_CHANGE","OTHER"
]);

function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"&&v.trim()?v.trim():null;}
function bool(fd:FormData,name:string){const v=text(fd,name);return v==="true"?true:v==="false"?false:null;}
function strings(fd:FormData,name:string){return fd.getAll(name).map(String).map(v=>v.trim()).filter(Boolean);}
function tri(fd:FormData,name:string){return enumValue(triSchema,text(fd,name));}
function enumValue<T extends z.ZodTypeAny>(schema:T,value:string|null){if(!value)return null;const r=schema.safeParse(value);return r.success?r.data:null;}

function parseCapaPlans(raw:string|null){
 if(!raw)return [];
 try{
  const a=JSON.parse(raw);
  if(!Array.isArray(a))return [];
  return a.filter((x):x is Record<string,unknown>=>Boolean(x&&typeof x==="object")).map((x)=>({
    id:typeof x.id==="string"?x.id:undefined,
    actionType:enumValue(capaActionSchema,typeof x.actionType==="string"?x.actionType:null)??"CORRECTIVE",
    description:typeof x.description==="string"?x.description.trim():"",
    plannedExecutionDate:typeof x.plannedExecutionDate==="string"?x.plannedExecutionDate:"",
    responsible:typeof x.responsible==="string"?x.responsible:"",
    businessCapaCode:typeof x.businessCapaCode==="string"?x.businessCapaCode:""
  })).filter((x)=>x.description);
 }catch{return [];}
}
export function parseComplaintForm(fd:FormData){
  const businessCode=text(fd,"businessCode"),departmentId=text(fd,"departmentId"),openedAt=text(fd,"openedAt"),
    createdByText=text(fd,"createdByText"),partyName=text(fd,"partyName"),description=text(fd,"description"),
    complaintType=enumValue(typeSchema,text(fd,"complaintType"));
  const status=enumValue(statusSchema,text(fd,"status"))??"OPEN";
  const classification=enumValue(classificationSchema,text(fd,"classification"));
  const effectivenessStatus=enumValue(efficacySchema,text(fd,"effectivenessStatus"))??"PENDING";
  const capaPlans=parseCapaPlans(text(fd,"capaPlansJson"));
  const resolutionActions=fd.getAll("resolutionActions").map(String).map(v=>enumValue(resolutionSchema,v)).filter((v):v is z.infer<typeof resolutionSchema>=>Boolean(v));
  const errors:string[]=[];
  if(!businessCode)errors.push("La codificación es obligatoria.");
  if(!departmentId)errors.push("El departamento es obligatorio.");
  if(!openedAt)errors.push("La fecha de apertura es obligatoria.");
  if(!createdByText)errors.push("Debe indicarse quién cumplimenta el expediente.");
  if(!complaintType)errors.push("Debe seleccionarse el tipo de reclamación.");
  if(!partyName)errors.push("Debe indicarse el cliente/proveedor.");
  if(!description)errors.push("La descripción de la reclamación es obligatoria.");
  if(status==="CLOSED"){
    if(!text(fd,"closedAt"))errors.push("Una reclamación cerrada requiere fecha de cierre.");
    if(!text(fd,"closeConclusion")&&!text(fd,"conclusion"))errors.push("Una reclamación cerrada requiere conclusión.");
    if(effectivenessStatus==="PENDING")errors.push("No puede cerrarse con eficacia pendiente. Indica Aceptable, No aceptable o No requerida.");
  }
  if(effectivenessStatus==="NOT_REQUIRED"&&bool(fd,"effectivenessRequired")===true){
    errors.push("La eficacia no puede figurar como No requerida si se ha indicado que es necesaria.");
  }
  return {errors,actor:text(fd,"modifiedByText")??createdByText??"Usuario no informado",values:{
    businessCode,departmentId,openedAt,detectionDate:text(fd,"detectionDate"),receptionDate:text(fd,"receptionDate"),detectedBy:text(fd,"detectedBy"),createdByText,
    complaintType,triggerSources:strings(fd,"triggerSources"),triggerOther:text(fd,"triggerOther"),partyName,contact:text(fd,"contact"),scopeCategories:strings(fd,"scopeCategories"),scopeOther:text(fd,"scopeOther"),affectedObjectTypes:strings(fd,"affectedObjectTypes"),affectedObjectOther:text(fd,"affectedObjectOther"),affectedScope:text(fd,"affectedScope"),reference:text(fd,"reference"),
    lotReference:text(fd,"lotReference"),quantity:text(fd,"quantity"),expiryReanalysis:text(fd,"expiryReanalysis"),
    purchaseDeliveryReference:text(fd,"purchaseDeliveryReference"),complaintCategories:strings(fd,"complaintCategories"),complaintCategoryOther:text(fd,"complaintCategoryOther"),description,recurrent:bool(fd,"recurrent"),
    recurrenceReference:text(fd,"recurrenceReference"),attachedDocumentation:text(fd,"attachedDocumentation"),
    emittedBy:text(fd,"emittedBy"),qaValidatedBy:text(fd,"qaValidatedBy"),
    qualityGmpImpact:tri(fd,"qualityGmpImpact"),
    safetyEfficacyImpact:tri(fd,"safetyEfficacyImpact"),
    regulatoryComplianceImpact:tri(fd,"regulatoryComplianceImpact"),
    environmentImpact:tri(fd,"environmentImpact"),
    similarSituationsImpact:tri(fd,"similarSituationsImpact"),
    containmentActions:strings(fd,"containmentActions"),
    containmentOther:text(fd,"containmentOther"),
    riskJustification:text(fd,"riskJustification"),
    investigation:text(fd,"investigation"),
    impactAssessment:text(fd,"impactAssessment"),investigationResult:enumValue(resultSchema,text(fd,"investigationResult")),
    rootCause:text(fd,"rootCause"),classification,withdrawalPotential:tri(fd,"withdrawalPotential"),recallProcedureRequired:tri(fd,"recallProcedureRequired"),authorityNotification:tri(fd,"authorityNotification"),responsiblePartyCommunication:tri(fd,"responsiblePartyCommunication"),regulatoryJustification:text(fd,"regulatoryJustification"),resolutionLines:text(fd,"resolutionLines"),resolutionActions,
    immediateActionDetails:text(fd,"immediateActionDetails"),otherResolutionDetails:text(fd,"otherResolutionDetails"),
    externalCommunicationDate:text(fd,"externalCommunicationDate"),externalCommunicationMedium:text(fd,"externalCommunicationMedium"),externalCommunicationParties:text(fd,"externalCommunicationParties"),externalCommunication:text(fd,"externalCommunication"),continueToPartII:bool(fd,"continueToPartII"),conclusion:text(fd,"conclusion"),
    effectivenessRequired:bool(fd,"effectivenessRequired"),initialEvaluationDate:text(fd,"initialEvaluationDate"),
    initialConclusionDate:text(fd,"initialConclusionDate"),responseDate:text(fd,"responseDate"),responseMedium:text(fd,"responseMedium"),
    responseSummary:text(fd,"responseSummary"),responseSufficient:bool(fd,"responseSufficient"),followupActionStatus:text(fd,"followupActionStatus"),followupReferences:text(fd,"followupReferences"),effectivenessStatus,effectivenessAssessment:text(fd,"effectivenessAssessment"),
    closeConclusion:text(fd,"closeConclusion"),approvalNames:text(fd,"approvalNames"),closeApprovalNames:text(fd,"closeApprovalNames"),
    closedAt:text(fd,"closedAt"),status,internalObservations:text(fd,"internalObservations"),
    signedDocumentAvailable:bool(fd,"signedDocumentAvailable"),dataQualityStatus:enumValue(qualitySchema,text(fd,"dataQualityStatus"))??"REVIEW_REQUIRED",
    capaPlans,changeReason:text(fd,"changeReason")
  }};
}
