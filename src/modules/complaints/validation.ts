import { z } from "zod";

const typeSchema=z.enum(["PROVIDER","CUSTOMER"]);
const classificationSchema=z.enum(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"]);
const resultSchema=z.enum(["PROCEDENT","NOT_PROCEDENT","INCONCLUSIVE","NOT_ATTRIBUTABLE_TO_COVEX"]);
const statusSchema=z.enum(["OPEN","CLOSED"]);
const efficacySchema=z.enum(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"]);
const qualitySchema=z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);
const capaActionSchema=z.enum(["CORRECTIVE","PREVENTIVE"]);
const triStateSchema=z.enum(["YES","NO","NA"]);
const resolutionSchema=z.enum([
"RETURN","CORRECTIVE_ACTION","PREVENTIVE_ACTION","IMMEDIATE_ACTION","RECALL","CREDIT","REPLACEMENT","REJECT","REPROCESS","DISPOSE","KEEP_AS_IS","SUPPLIER_INVESTIGATION","SUPPLIER_EVALUATION","OPEN_DEVIATION","OPEN_CAPA","OPEN_CHANGE","OTHER"
]);

function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"&&v.trim()?v.trim():null;}
function bool(fd:FormData,name:string){const v=text(fd,name);return v==="true"?true:v==="false"?false:null;}
function enumValue<T extends z.ZodTypeAny>(schema:T,value:string|null){if(!value)return null;const r=schema.safeParse(value);return r.success?r.data:null;}
function list(fd:FormData,name:string){return fd.getAll(name).map(String).map(v=>v.trim()).filter(Boolean);}
function tri(fd:FormData,name:string){return enumValue(triStateSchema,text(fd,name));}

function parseDerivedActions(raw:string|null){
 if(!raw)return [];
 try{
  const a=JSON.parse(raw);
  if(!Array.isArray(a))return [];
  return a.filter((x):x is Record<string,unknown>=>Boolean(x&&typeof x==="object")).map((x)=>({
    id:typeof x.id==="string"?x.id:undefined,
    typeCode:typeof x.typeCode==="string"?x.typeCode.trim():"",
    actionEvidence:typeof x.actionEvidence==="string"?x.actionEvidence.trim():"",
    responsible:typeof x.responsible==="string"?x.responsible.trim():"",
    plannedDate:typeof x.plannedDate==="string"?x.plannedDate:""
  })).filter((x)=>x.typeCode||x.actionEvidence);
 }catch{return [];}
}

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
  const derivedActions=parseDerivedActions(text(fd,"derivedActionsJson"));
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
    businessCode,departmentId,openedAt,detectionDate:text(fd,"detectionDate"),receivedAt:text(fd,"receivedAt"),detectedBy:text(fd,"detectedBy"),createdByText,
    complaintType,detectionSources:list(fd,"detectionSources"),otherDetectionSource:text(fd,"otherDetectionSource"),
    scopeCategories:list(fd,"scopeCategories"),otherScopeCategory:text(fd,"otherScopeCategory"),
    affectedObjects:list(fd,"affectedObjects"),otherAffectedObject:text(fd,"otherAffectedObject"),
    complaintCategories:list(fd,"complaintCategories"),otherComplaintCategory:text(fd,"otherComplaintCategory"),
    partyName,contact:text(fd,"contact"),affectedScope:text(fd,"affectedScope"),reference:text(fd,"reference"),
    lotReference:text(fd,"lotReference"),quantity:text(fd,"quantity"),expiryReanalysis:text(fd,"expiryReanalysis"),
    purchaseDeliveryReference:text(fd,"purchaseDeliveryReference"),description,recurrent:bool(fd,"recurrent"),
    recurrenceReference:text(fd,"recurrenceReference"),attachedDocumentation:text(fd,"attachedDocumentation"),
    emittedBy:text(fd,"emittedBy"),qaValidatedBy:text(fd,"qaValidatedBy"),investigation:text(fd,"investigation"),
    impactAssessment:text(fd,"impactAssessment"),
    impactQualityGmp:bool(fd,"impactQualityGmp"),impactSafetyEfficacy:bool(fd,"impactSafetyEfficacy"),
    impactRegulatory:bool(fd,"impactRegulatory"),impactEnvironment:bool(fd,"impactEnvironment"),impactOtherSimilar:bool(fd,"impactOtherSimilar"),
    containmentActions:list(fd,"containmentActions"),otherContainmentAction:text(fd,"otherContainmentAction"),containmentJustification:text(fd,"containmentJustification"),
    investigationResult:enumValue(resultSchema,text(fd,"investigationResult")),
    rootCause:text(fd,"rootCause"),classification,
    recallPotential:tri(fd,"recallPotential"),recallProcedureRequired:tri(fd,"recallProcedureRequired"),
    authorityNotificationRequired:tri(fd,"authorityNotificationRequired"),responsibleClientCommunicationRequired:tri(fd,"responsibleClientCommunicationRequired"),
    regulatoryJustification:text(fd,"regulatoryJustification"),
    resolutionLines:text(fd,"resolutionLines"),resolutionActions,
    immediateActionDetails:text(fd,"immediateActionDetails"),otherResolutionDetails:text(fd,"otherResolutionDetails"),
    externalCommunication:text(fd,"externalCommunication"),
    communicationDate:text(fd,"communicationDate"),communicationMedium:text(fd,"communicationMedium"),
    communicationSenderRecipient:text(fd,"communicationSenderRecipient"),communicationSummary:text(fd,"communicationSummary"),
    conclusion:text(fd,"conclusion"),continueToPartII:bool(fd,"continueToPartII"),
    effectivenessRequired:bool(fd,"effectivenessRequired"),initialEvaluationDate:text(fd,"initialEvaluationDate"),
    initialConclusionDate:text(fd,"initialConclusionDate"),responseDate:text(fd,"responseDate"),responseMedium:text(fd,"responseMedium"),
    responseSummary:text(fd,"responseSummary"),responseSufficient:bool(fd,"responseSufficient"),effectivenessStatus,effectivenessAssessment:text(fd,"effectivenessAssessment"),
    closeConclusion:text(fd,"closeConclusion"),closureActionStatus:text(fd,"closureActionStatus"),closureActionReferences:text(fd,"closureActionReferences"),
    closureActionResponsible:text(fd,"closureActionResponsible"),approvalNames:text(fd,"approvalNames"),closeApprovalNames:text(fd,"closeApprovalNames"),
    closedAt:text(fd,"closedAt"),status,internalObservations:text(fd,"internalObservations"),
    signedDocumentAvailable:bool(fd,"signedDocumentAvailable"),dataQualityStatus:enumValue(qualitySchema,text(fd,"dataQualityStatus"))??"REVIEW_REQUIRED",
    capaPlans,derivedActions,changeReason:text(fd,"changeReason")
  }};
}
