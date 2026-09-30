import { z } from "zod";
import type { ComplaintDerivedActionInput } from "@/modules/complaints/types";
import { requestedWorkflowStatus } from "@/lib/forms/draft-workflow";

const typeSchema=z.enum(["PROVIDER","CUSTOMER"]);
const classificationSchema=z.enum(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"]);
const resultSchema=z.enum(["PROCEDENT","NOT_PROCEDENT","INCONCLUSIVE","NOT_ATTRIBUTABLE_TO_COVEX"]);
const statusSchema=z.enum(["DRAFT","OPEN","CLOSED"]);
const efficacySchema=z.enum(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"]);
const qualitySchema=z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);
const triSchema=z.enum(["YES","NO","NA"]);
const capaActionSchema=z.enum(["CORRECTIVE","PREVENTIVE"]);
const resolutionSchema=z.enum([
"RETURN","CORRECTIVE_ACTION","PREVENTIVE_ACTION","IMMEDIATE_ACTION","RECALL","CREDIT","REPLACEMENT","REJECT","REPROCESS","DISPOSE","KEEP_AS_IS","SUPPLIER_INVESTIGATION","SUPPLIER_EVALUATION","OPEN_DEVIATION","OPEN_CAPA","OPEN_CHANGE","OTHER"
]);

function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"&&v.trim()?v.trim():null;}
function bool(fd:FormData,name:string){const v=text(fd,name);return v==="true"?true:v==="false"?false:null;}
function enumValue<T extends z.ZodTypeAny>(schema:T,value:string|null){if(!value)return null;const r=schema.safeParse(value);return r.success?r.data:null;}
function list(fd:FormData,name:string){return fd.getAll(name).map(String).map(x=>x.trim()).filter(Boolean);}
function tri(fd:FormData,name:string){return enumValue(triSchema,text(fd,name));}

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
function parseDerivedActions(raw:string|null):ComplaintDerivedActionInput[]{
 if(!raw)return [];
 try{
  const a=JSON.parse(raw);
  if(!Array.isArray(a))return [];
  return a.filter((x):x is Record<string,unknown>=>Boolean(x&&typeof x==="object")).map((x,i)=>({
   id:typeof x.id==="string"?x.id:undefined,
   actionType:typeof x.actionType==="string"?x.actionType.trim():"",
   businessCode:typeof x.businessCode==="string"?x.businessCode.trim():"",
   description:typeof x.description==="string"?x.description.trim():"",
   responsible:typeof x.responsible==="string"?x.responsible.trim():"",
   plannedExecutionDate:typeof x.plannedExecutionDate==="string"?x.plannedExecutionDate:"",
   sortOrder:typeof x.sortOrder==="number"?x.sortOrder:i*10,
  })).filter(x=>x.actionType||x.businessCode||x.description);
 }catch{return [];}
}

export function parseComplaintForm(fd:FormData){
  const businessCode=text(fd,"businessCode"),departmentId=text(fd,"departmentId"),openedAt=text(fd,"openedAt"),
    createdByText=text(fd,"createdByText"),partyName=text(fd,"partyName"),description=text(fd,"description"),
    complaintType=enumValue(typeSchema,text(fd,"complaintType"));
  const storedStatus=enumValue(statusSchema,text(fd,"status"))??"OPEN";
  const status=requestedWorkflowStatus(fd,storedStatus);
  const draftMode=status==="DRAFT";
  const classification=enumValue(classificationSchema,text(fd,"classification"));
  const effectivenessStatus=enumValue(efficacySchema,text(fd,"effectivenessStatus"))??"PENDING";
  const capaPlans=parseCapaPlans(text(fd,"capaPlansJson"));
  const derivedActions=parseDerivedActions(text(fd,"derivedActionsJson"));
  const resolutionActions=fd.getAll("resolutionActions").map(String).map(v=>enumValue(resolutionSchema,v)).filter((v):v is z.infer<typeof resolutionSchema>=>Boolean(v));
  const errors:string[]=[];
  const required=(condition:boolean,message:string)=>{if(condition&&!draftMode)errors.push(message);};
  required(!businessCode,"La codificación es obligatoria.");
  required(!departmentId,"El departamento es obligatorio.");
  required(!openedAt,"La fecha de apertura es obligatoria.");
  required(!createdByText,"Debe indicarse quién cumplimenta el expediente.");
  required(!complaintType,"Debe seleccionarse el tipo de reclamación.");
  required(!partyName,"Debe indicarse el cliente/proveedor.");
  required(!description,"La descripción de la reclamación es obligatoria.");
  if(status==="CLOSED"){
    if(!text(fd,"closedAt"))errors.push("Una reclamación cerrada requiere fecha de cierre.");
    if(!text(fd,"closeConclusion")&&!text(fd,"conclusion"))errors.push("Una reclamación cerrada requiere conclusión.");
    if(effectivenessStatus==="PENDING")errors.push("No puede cerrarse con eficacia pendiente. Indica Aceptable, No aceptable o No requerida.");
  }
  if(effectivenessStatus==="NOT_REQUIRED"&&bool(fd,"effectivenessRequired")===true){
    errors.push("La eficacia no puede figurar como No requerida si se ha indicado que es necesaria.");
  }
  if(!draftMode&&text(fd,"sourceOther")&&!list(fd,"sourceTypes").includes("OTHER"))errors.push("Si se especifica otro origen, marca también «Otro».");
  if(!draftMode&&text(fd,"categoryOther")&&!list(fd,"categoryTypes").includes("OTHER"))errors.push("Si se especifica otra categoría, marca también «Otro».");

  return {errors,actor:text(fd,"modifiedByText")??createdByText??"Usuario no informado",values:{
    businessCode,departmentId,openedAt,detectionDate:text(fd,"detectionDate"),receptionDate:text(fd,"receptionDate"),detectedBy:text(fd,"detectedBy"),createdByText,
    complaintType,sourceTypes:list(fd,"sourceTypes"),sourceOther:text(fd,"sourceOther"),scopeTypes:list(fd,"scopeTypes"),scopeOther:text(fd,"scopeOther"),
    affectedObjectTypes:list(fd,"affectedObjectTypes"),affectedObjectOther:text(fd,"affectedObjectOther"),categoryTypes:list(fd,"categoryTypes"),categoryOther:text(fd,"categoryOther"),
    partyName,contact:text(fd,"contact"),affectedScope:text(fd,"affectedScope"),reference:text(fd,"reference"),
    lotReference:text(fd,"lotReference"),quantity:text(fd,"quantity"),expiryReanalysis:text(fd,"expiryReanalysis"),
    purchaseDeliveryReference:text(fd,"purchaseDeliveryReference"),description,recurrent:bool(fd,"recurrent"),
    recurrenceReference:text(fd,"recurrenceReference"),attachedDocumentation:text(fd,"attachedDocumentation"),
    emittedBy:text(fd,"emittedBy"),qaValidatedBy:text(fd,"qaValidatedBy"),investigation:text(fd,"investigation"),
    impactAssessment:text(fd,"impactAssessment"),impactQualityGmp:tri(fd,"impactQualityGmp"),impactSafetyEfficacy:tri(fd,"impactSafetyEfficacy"),
    impactRegulatory:tri(fd,"impactRegulatory"),impactEnvironment:tri(fd,"impactEnvironment"),impactOtherSimilar:tri(fd,"impactOtherSimilar"),
    containmentActions:list(fd,"containmentActions"),containmentOther:text(fd,"containmentOther"),riskJustification:text(fd,"riskJustification"),
    investigationResult:enumValue(resultSchema,text(fd,"investigationResult")),rootCause:text(fd,"rootCause"),classification,
    potentialRecall:tri(fd,"potentialRecall"),recallProcedureRequired:tri(fd,"recallProcedureRequired"),
    authorityNotificationRequired:tri(fd,"authorityNotificationRequired"),responsiblePartyCommunicationRequired:tri(fd,"responsiblePartyCommunicationRequired"),
    regulatoryJustification:text(fd,"regulatoryJustification"),
    resolutionLines:text(fd,"resolutionLines"),resolutionActions,immediateActionDetails:text(fd,"immediateActionDetails"),otherResolutionDetails:text(fd,"otherResolutionDetails"),
    externalCommunication:text(fd,"externalCommunication"),communicationDate:text(fd,"communicationDate"),communicationMedium:text(fd,"communicationMedium"),
    communicationParties:text(fd,"communicationParties"),communicationSummary:text(fd,"communicationSummary"),
    partIIRequired:bool(fd,"partIIRequired"),conclusion:text(fd,"conclusion"),effectivenessRequired:bool(fd,"effectivenessRequired"),
    initialEvaluationDate:text(fd,"initialEvaluationDate"),initialConclusionDate:text(fd,"initialConclusionDate"),
    responseDate:text(fd,"responseDate"),responseMedium:text(fd,"responseMedium"),responseSummary:text(fd,"responseSummary"),
    responseSufficient:bool(fd,"responseSufficient"),effectivenessStatus,effectivenessAssessment:text(fd,"effectivenessAssessment"),
    closeActionStatus:text(fd,"closeActionStatus"),closeActionReferences:text(fd,"closeActionReferences"),
    closeConclusion:text(fd,"closeConclusion"),approvalNames:text(fd,"approvalNames"),closeApprovalNames:text(fd,"closeApprovalNames"),
    closedAt:text(fd,"closedAt"),status,internalObservations:text(fd,"internalObservations"),
    signedDocumentAvailable:bool(fd,"signedDocumentAvailable"),dataQualityStatus:enumValue(qualitySchema,text(fd,"dataQualityStatus"))??"REVIEW_REQUIRED",
    capaPlans,derivedActions,changeReason:text(fd,"changeReason")
  }};
}
