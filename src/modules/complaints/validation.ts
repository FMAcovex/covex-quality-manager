import { z } from "zod";
import type { ComplaintDerivedActionInput } from "@/modules/complaints/types";

const typeSchema=z.enum(["PROVIDER","CUSTOMER"]);
const classificationSchema=z.enum(["CRITICAL","MAJOR","MINOR","NO_GMP_IMPACT"]);
const resultSchema=z.enum(["PROCEDENT","NOT_PROCEDENT","INCONCLUSIVE","NOT_ATTRIBUTABLE_TO_COVEX"]);
const statusSchema=z.enum(["DRAFT","OPEN","CLOSED"]);
const efficacySchema=z.enum(["PENDING","ACCEPTABLE","NOT_ACCEPTABLE","NOT_REQUIRED"]);
const qualitySchema=z.enum(["COMPLETE","INCOMPLETE","REVIEW_REQUIRED"]);
const triSchema=z.enum(["YES","NO","NA"]);
const yesNoSchema=z.enum(["YES","NO"]);
const capaActionSchema=z.enum(["CORRECTIVE","PREVENTIVE"]);
const resolutionSchema=z.enum([
  "RETURN","CORRECTIVE_ACTION","PREVENTIVE_ACTION","IMMEDIATE_ACTION",
  "RECALL","CREDIT","REPLACEMENT","OTHER"
]);

function text(fd:FormData,name:string){const v=fd.get(name);return typeof v==="string"&&v.trim()?v.trim():null;}
function bool(fd:FormData,name:string){const v=text(fd,name);return v==="true"?true:v==="false"?false:null;}
function enumValue<T extends z.ZodTypeAny>(schema:T,value:string|null){if(!value)return null;const r=schema.safeParse(value);return r.success?r.data:null;}
function list(fd:FormData,name:string){return fd.getAll(name).map(String).map(x=>x.trim()).filter(Boolean);}
function tri(fd:FormData,name:string){return enumValue(triSchema,text(fd,name));}
function yesNo(fd:FormData,name:string){return enumValue(yesNoSchema,text(fd,name));}

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
  })).filter((x)=>x.description||x.responsible||x.plannedExecutionDate||x.businessCapaCode);
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
  })).filter(x=>x.actionType||x.businessCode||x.description||x.responsible||x.plannedExecutionDate);
 }catch{return [];}
}

export function parseComplaintForm(fd:FormData,linked:{capa?:boolean;returns?:boolean}={}){
  const businessCode=text(fd,"businessCode"),departmentId=text(fd,"departmentId"),openedAt=text(fd,"openedAt"),
    createdByText=text(fd,"createdByText"),partyName=text(fd,"partyName"),description=text(fd,"description"),
    complaintType=enumValue(typeSchema,text(fd,"complaintType"));
  const status=enumValue(statusSchema,text(fd,"saveStatus")??text(fd,"status"))??"DRAFT";
  const classification=enumValue(classificationSchema,text(fd,"classification"));
  let effectivenessStatus=enumValue(efficacySchema,text(fd,"effectivenessStatus"))??"PENDING";
  const capaPlans=parseCapaPlans(text(fd,"capaPlansJson"));
  const derivedActions=parseDerivedActions(text(fd,"derivedActionsJson"));
  const resolutionActions=fd.getAll("resolutionActions").map(String).map(v=>enumValue(resolutionSchema,v)).filter((v):v is z.infer<typeof resolutionSchema>=>Boolean(v));
  const sourceTypes=list(fd,"sourceTypes"), scopeTypes=list(fd,"scopeTypes"), affectedObjectTypes=list(fd,"affectedObjectTypes"), categoryTypes=list(fd,"categoryTypes");
  const containmentActions=list(fd,"containmentActions");
  const partIIRequired=bool(fd,"partIIRequired");
  if(partIIRequired===false)effectivenessStatus="NOT_REQUIRED";
  if(partIIRequired===null)effectivenessStatus="PENDING";
  const simplified=classification==="NO_GMP_IMPACT";
  const hasDerivedActions=bool(fd,"hasDerivedActions")??(simplified?false:null);
  const nextFollowupDate=text(fd,"nextFollowupDate");
  const recurrent=bool(fd,"recurrent");
  const errors:string[]=[];
  if(!complaintType)errors.push("Debe seleccionarse el tipo de reclamación.");

  if(status!=="DRAFT"){
    const requiredText:Array<[string|null,string,boolean?]>=[
      [departmentId,"El departamento es obligatorio.",true],
      [openedAt,"La fecha de apertura es obligatoria.",true],
      [createdByText,"Debe indicarse quién cumplimenta el expediente.",true],
      [text(fd,"detectionDate"),"La fecha de detección es obligatoria."],
      [text(fd,"receptionDate"),"La fecha de recepción es obligatoria."],
      [partyName,"Debe indicarse el cliente/proveedor."],
      [text(fd,"contact"),"El contacto es obligatorio."],
      [text(fd,"reference"),"La referencia del material/servicio/equipo es obligatoria."],
      [description,"La descripción de la reclamación es obligatoria.",true],
      [text(fd,"emittedBy"),"Debe indicarse quién emite la reclamación.",true],
      [text(fd,"riskJustification"),"La justificación del riesgo, alcance y medidas es obligatoria."],
      [text(fd,"investigation"),"La investigación y evidencias son obligatorias."],
      [text(fd,"impactAssessment"),"La conclusión del impacto es obligatoria.",true],
      [text(fd,"rootCause"),"El análisis de causa raíz es obligatorio; si no procede, debe justificarse."],
      [text(fd,"regulatoryJustification"),"La justificación de la evaluación regulatoria es obligatoria."],
      [text(fd,"resolutionLines"),"Las líneas de actuación y resolución son obligatorias."],
      [text(fd,"communicationDate"),"La fecha de comunicación es obligatoria."],
      [text(fd,"communicationMedium"),"El medio de comunicación es obligatorio."],
      [text(fd,"communicationParties"),"El emisor/destinatario es obligatorio."],
      [text(fd,"communicationSummary"),"El resumen de lo comunicado o solicitado es obligatorio."],
      [text(fd,"conclusion"),"La conclusión de la Parte I es obligatoria.",true]
    ];
    requiredText.forEach(([value,message,simplifiedRequired])=>{if(!value&&(!simplified||simplifiedRequired))errors.push(message);});
    if(simplified){
      if(yesNo(fd,"impactQualityGmp")!=="NO"||yesNo(fd,"impactEnvironment")!=="NO"||["impactSafetyEfficacy","impactRegulatory","impactOtherSimilar"].some(key=>yesNo(fd,key)==="YES"))errors.push("El registro simplificado requiere evaluación de ausencia de impacto GMP y ambiental; si hay impacto debe abrirse el informe completo.");
    }
    if(!simplified){
        if(!sourceTypes.length)errors.push("Debe seleccionarse al menos un origen o fuente de detección.");
    if(!scopeTypes.length)errors.push("Debe seleccionarse al menos un ámbito.");
    if(!affectedObjectTypes.length)errors.push("Debe seleccionarse el objeto afectado.");
    if(!categoryTypes.length)errors.push("Debe seleccionarse al menos una categoría o motivo.");
    if(recurrent===null)errors.push("Debe indicarse si la reclamación es recurrente.");
    if(recurrent===true&&!text(fd,"recurrenceReference"))errors.push("Una reclamación recurrente requiere referencia.");
    if(!yesNo(fd,"impactQualityGmp")||!yesNo(fd,"impactSafetyEfficacy")||!yesNo(fd,"impactRegulatory")||!yesNo(fd,"impactEnvironment")||!yesNo(fd,"impactOtherSimilar")){
      errors.push("Las cinco preguntas de evaluación inicial del impacto deben responderse Sí o No.");
    }
    if(!containmentActions.length)errors.push("Debe informarse al menos una medida inmediata/contención, incluida «Ninguna» cuando corresponda.");
    if(!enumValue(resultSchema,text(fd,"investigationResult")))errors.push("Debe informarse el resultado de la investigación.");
    if(!classification)errors.push("La clasificación de la reclamación es obligatoria.");
    if(!tri(fd,"potentialRecall")||!tri(fd,"recallProcedureRequired")||!tri(fd,"authorityNotificationRequired")||!tri(fd,"responsiblePartyCommunicationRequired")){
      errors.push("La evaluación regulatoria debe responderse completamente.");
    }
    }
    if(hasDerivedActions===null)errors.push("Debe indicarse si existen acciones derivadas.");
    if(hasDerivedActions===true&&!resolutionActions.length)errors.push("Si existen acciones derivadas debe seleccionarse al menos una.");
    if(hasDerivedActions===false&&resolutionActions.length)errors.push("No pueden seleccionarse acciones derivadas si se ha indicado que no existen.");
    if(resolutionActions.includes("CORRECTIVE_ACTION")&&!linked.capa&&!capaPlans.some(x=>x.actionType==="CORRECTIVE"))errors.push("La acción correctora requiere al menos una CAPA propuesta o vinculada.");
    if(resolutionActions.includes("PREVENTIVE_ACTION")&&!linked.capa&&!capaPlans.some(x=>x.actionType==="PREVENTIVE"))errors.push("La acción preventiva requiere al menos una CAPA propuesta o vinculada.");
    if(resolutionActions.includes("RETURN")&&!linked.returns&&!derivedActions.some(x=>x.actionType==="RETURN"))errors.push("La devolución requiere al menos una devolución propuesta o vinculada.");
    if(resolutionActions.includes("IMMEDIATE_ACTION")&&!text(fd,"immediateActionDetails"))errors.push("La acción inmediata debe especificarse.");
    if(resolutionActions.includes("RECALL")&&!text(fd,"recallActionDetails"))errors.push("La retirada del mercado debe especificarse.");
    if(resolutionActions.includes("CREDIT")&&!text(fd,"creditActionDetails"))errors.push("El abono debe especificarse.");
    if(resolutionActions.includes("REPLACEMENT")&&!text(fd,"replacementActionDetails"))errors.push("La reposición debe especificarse.");
    if(resolutionActions.includes("OTHER")&&!text(fd,"otherResolutionDetails"))errors.push("La acción «Otros» debe especificarse.");
    if(status==="OPEN"&&!nextFollowupDate)errors.push("Una reclamación abierta requiere fecha de próximo seguimiento.");
  }

  if(!simplified&&affectedObjectTypes.includes("PRODUCT_MATERIAL")&&status!=="DRAFT"){
    if(!text(fd,"lotReference"))errors.push("Para producto/material debe indicarse el lote.");
    if(!text(fd,"quantity"))errors.push("Para producto/material debe indicarse la cantidad.");
    if(!text(fd,"expiryReanalysis"))errors.push("Para producto/material debe indicarse caducidad/reanálisis.");
  }

  if(partIIRequired===true&&status!=="DRAFT"){
    if(!text(fd,"responseDate"))errors.push("La Parte II requiere fecha de respuesta.");
    if(!text(fd,"responseMedium"))errors.push("La Parte II requiere medio de respuesta.");
    if(!text(fd,"responseSummary"))errors.push("La Parte II requiere resumen de la respuesta/compromisos.");
    if(bool(fd,"responseSufficient")===null)errors.push("Debe indicarse si la respuesta es suficiente.");
    if(!text(fd,"effectivenessAssessment"))errors.push("Debe documentarse la valoración de eficacia.");
    if(!text(fd,"closeActionStatus"))errors.push("Debe informarse el estado de las acciones en Parte II.");
    if(!text(fd,"closeActionReferences"))errors.push("Debe informarse la referencia/responsable del seguimiento de acciones.");
  }

  if(status==="CLOSED"){
    if(partIIRequired===null)errors.push("No puede cerrarse una reclamación con la decisión de Parte II pendiente.");
    if(!text(fd,"closedAt"))errors.push("Una reclamación cerrada requiere fecha de cierre.");
    if(!text(fd,"closeConclusion")&&!text(fd,"conclusion"))errors.push("Una reclamación cerrada requiere conclusión.");
    if(partIIRequired===true&&!text(fd,"closeConclusion"))errors.push("El cierre en Parte II requiere su conclusión de cierre.");
    if(partIIRequired===true&&text(fd,"closeActionStatus")==="PENDING")errors.push("Antes del cierre, completa las acciones necesarias o justifica su seguimiento independiente con referencias.");
    if(partIIRequired===true&&effectivenessStatus==="PENDING")errors.push("No puede cerrarse con eficacia pendiente. Indica Conforme, No conforme o N/A.");
  }

  if(status!=="DRAFT")for(const plan of capaPlans){
    if(!plan.description||!plan.responsible||!plan.plannedExecutionDate){
      errors.push("Cada CAPA propuesta/vinculada debe incluir descripción, responsable y fecha prevista.");
      break;
    }
  }
  if(status!=="DRAFT")for(const action of derivedActions){
    if(!action.actionType||!action.description||!action.responsible||!action.plannedExecutionDate){
      errors.push("Cada acción/registro derivado debe incluir tipo, descripción, responsable y fecha prevista.");
      break;
    }
  }

  for(const name of ["openedAt","detectionDate","receptionDate","communicationDate","nextFollowupDate","responseDate","closedAt","initialEvaluationDate","initialConclusionDate"]){
    const value=text(fd,name);
    if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))errors.push(`La fecha ${name} no es válida.`);
  }
  return {errors,actor:text(fd,"modifiedByText")??createdByText??"Usuario no informado",values:{
    businessCode,departmentId,openedAt,detectionDate:text(fd,"detectionDate"),receptionDate:text(fd,"receptionDate"),detectedBy:text(fd,"detectedBy"),createdByText,
    complaintType,sourceTypes,sourceOther:text(fd,"sourceOther"),scopeTypes,scopeOther:text(fd,"scopeOther"),
    affectedObjectTypes,affectedObjectOther:text(fd,"affectedObjectOther"),categoryTypes,categoryOther:text(fd,"categoryOther"),
    partyName,contact:text(fd,"contact"),affectedScope:text(fd,"affectedScope"),reference:text(fd,"reference"),
    lotReference:text(fd,"lotReference"),quantity:text(fd,"quantity"),expiryReanalysis:text(fd,"expiryReanalysis"),
    purchaseDeliveryReference:text(fd,"purchaseDeliveryReference"),description,recurrent,
    recurrenceReference:text(fd,"recurrenceReference"),attachedDocumentation:text(fd,"attachedDocumentation"),
    emittedBy:text(fd,"emittedBy"),qaValidatedBy:text(fd,"qaValidatedBy"),investigation:text(fd,"investigation"),
    impactAssessment:text(fd,"impactAssessment"),impactQualityGmp:yesNo(fd,"impactQualityGmp"),impactSafetyEfficacy:yesNo(fd,"impactSafetyEfficacy"),
    impactRegulatory:yesNo(fd,"impactRegulatory"),impactEnvironment:yesNo(fd,"impactEnvironment"),impactOtherSimilar:yesNo(fd,"impactOtherSimilar"),
    containmentActions,containmentOther:text(fd,"containmentOther"),riskJustification:text(fd,"riskJustification"),
    investigationResult:enumValue(resultSchema,text(fd,"investigationResult")),rootCause:text(fd,"rootCause"),classification,
    potentialRecall:tri(fd,"potentialRecall"),recallProcedureRequired:tri(fd,"recallProcedureRequired"),
    authorityNotificationRequired:tri(fd,"authorityNotificationRequired"),responsiblePartyCommunicationRequired:tri(fd,"responsiblePartyCommunicationRequired"),
    regulatoryJustification:text(fd,"regulatoryJustification"),
    resolutionLines:text(fd,"resolutionLines"),resolutionActions,hasDerivedActions,
    immediateActionDetails:text(fd,"immediateActionDetails"),recallActionDetails:text(fd,"recallActionDetails"),
    creditActionDetails:text(fd,"creditActionDetails"),replacementActionDetails:text(fd,"replacementActionDetails"),
    otherResolutionDetails:text(fd,"otherResolutionDetails"),
    externalCommunication:text(fd,"externalCommunication"),communicationDate:text(fd,"communicationDate"),communicationMedium:text(fd,"communicationMedium"),
    communicationParties:text(fd,"communicationParties"),communicationSummary:text(fd,"communicationSummary"),
    partIIRequired,nextFollowupDate,conclusion:text(fd,"conclusion"),effectivenessRequired:bool(fd,"effectivenessRequired"),
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
