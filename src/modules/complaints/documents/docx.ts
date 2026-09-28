import { Prisma } from "@prisma/client";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import {
  replaceWordRowWithCopies,
  setWordCellTextBalanced,
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintAnnexIIITemplate,ComplaintTemplateUnavailableError } from "@/modules/complaints/documents/templates";
import { parseComplaintRevision03Json } from "@/modules/complaints/revision03";

type Capa={actionType:string;description:string;plannedExecutionDate:Date|null;responsible:string|null;businessCapaCode?:string|null};
type Followup={followupDate:Date;comment:string;nextFollowupDate:Date|null;evidenceReference:string|null};
export type ComplaintDocumentRecord={
 qmsRecord:{businessCode:string|null};openedAt:Date|null;detectionDate:Date|null;detectedBy:string|null;createdByText?:string|null;complaintType:string;partyName:string|null;contact:string|null;
 affectedScope:string|null;reference:string|null;lotReference:string|null;quantity:string|null;expiryReanalysis:string|null;purchaseDeliveryReference?:string|null;description:string|null;recurrent:boolean|null;
 recurrenceReference:string|null;attachedDocumentation:string|null;emittedBy:string|null;qaValidatedBy:string|null;investigation:string|null;impactAssessment:string|null;
 investigationResult:string|null;rootCause:string|null;classification:string|null;resolutionLines:string|null;resolutionActions:string[];immediateActionDetails:string|null;
 otherResolutionDetails:string|null;externalCommunication:string|null;conclusion:string|null;effectivenessRequired:boolean|null;approvalNames:string|null;
 initialEvaluationDate?:Date|null;initialConclusionDate?:Date|null;responseDate:Date|null;responseMedium:string|null;responseSummary:string|null;effectivenessStatus:string;effectivenessAssessment:string|null;closeConclusion:string|null;
 closeApprovalNames:string|null;closedAt:Date|null;status?:string;internalObservations:string|null;capaPlans:Capa[];followups:Followup[];
 extraData?:Prisma.JsonValue|null;
 annexIIITemplateVersion?:{versionCode:string}|null;annexIVTemplateVersion?:{versionCode:string}|null;annexVTemplateVersion?:{versionCode:string}|null;
};
const date=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const text=(v:string|null|undefined)=>v??"";
const box=(on:boolean,label:string)=>`${on?"☒":"☐"} ${label}`;
const tri=(v:string|null)=>`${box(v==="YES","Sí")}   ${box(v==="NO","No")}   ${box(v==="NA","N/A")}`;
const selected=(items:string[],label:string)=>items.includes(label);
const listBoxes=(items:string[],labels:string[],other?:string|null)=>[
 ...labels.map(label=>box(selected(items,label),label)),
 other? `Otro: ${other}` : "",
].filter(Boolean).join("   ");

function classificationLine(value:string|null,key:string,label:string){
 return `${box(value===key,label)}`;
}

function resultText(value:string|null){
 return [
  box(value==="PROCEDENT","Procedente"),
  box(value==="NOT_PROCEDENT","No procedente"),
  box(value==="INCONCLUSIVE","No concluyente"),
  box(value==="NOT_ATTRIBUTABLE_TO_COVEX","No atribuible a COVEX"),
 ].join("   ");
}

function derivedFlags(actions:string[],immediate:string|null,other:string|null){
 return [
  box(actions.includes("RETURN"),"DEVOLUCIÓN"),
  box(actions.includes("CORRECTIVE_ACTION"),"ACC. CORRECTORA"),
  box(actions.includes("PREVENTIVE_ACTION"),"ACC. PREVENTIVA"),
  box(actions.includes("IMMEDIATE_ACTION"),`ACC. INMEDIATA${immediate?`: ${immediate}`:""}`),
  box(actions.includes("RECALL"),"RETIRADA DEL MERCADO"),
  box(actions.includes("CREDIT"),"ABONO"),
  box(actions.includes("REPLACEMENT"),"REPOSICIÓN"),
  box(actions.includes("OTHER"),`OTROS${other?`: ${other}`:""}`),
 ].join("   ");
}

export async function generateComplaintAnnexIII(r:ComplaintDocumentRecord){
 const revision=parseComplaintRevision03Json(r.extraData);
 const entries=readZip(await loadComplaintAnnexIIITemplate(r.annexIIITemplateVersion?.versionCode??"03"));
 let xml=getZipEntryText(entries,"word/document.xml");

 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));
 xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));
 xml=setWordCellTextBalanced(xml,0,1,5,r.annexIIITemplateVersion?.versionCode??"03");

 xml=setWordCellTextBalanced(xml,1,1,1,date(r.detectionDate));
 xml=setWordCellTextBalanced(xml,1,1,3,text(revision.receivedAt));
 xml=setWordCellTextBalanced(xml,1,2,1,box(r.complaintType==="PROVIDER","A PROVEEDOR / SUBCONTRATA"));
 xml=setWordCellTextBalanced(xml,1,2,2,box(r.complaintType==="CUSTOMER","DE CLIENTE / AGENTE EXTERNO"));
 xml=setWordCellTextBalanced(xml,1,3,1,listBoxes(revision.sourceFlags,["Cliente","Distribuidor","Titular / MAH","Consumidor / usuario","Autoridad / entidad sanitaria","Proveedor","Transportista / operador logístico","Subcontrata","Detección interna","Retirada"],revision.sourceOther));
 xml=setWordCellTextBalanced(xml,1,4,1,revision.sourceOther??"");
 xml=setWordCellTextBalanced(xml,1,5,1,text(r.contact));
 xml=setWordCellTextBalanced(xml,1,6,1,listBoxes(revision.scopeFlags,["Medicamento","API","Complemento alimenticio","Cosmética","Producto sanitario","Medio ambiente"],revision.scopeOther));
 xml=setWordCellTextBalanced(xml,1,7,1,listBoxes(revision.objectFlags,["Producto / material","Servicio","Equipo / sistema","Transporte","Actividad subcontratada"],revision.objectOther));
 xml=setWordCellTextBalanced(xml,1,8,1,text(r.reference));
 xml=setWordCellTextBalanced(xml,1,8,3,text(r.lotReference));
 xml=setWordCellTextBalanced(xml,1,9,3,text(r.quantity));
 xml=setWordCellTextBalanced(xml,1,10,3,text(r.expiryReanalysis));
 xml=setWordCellTextBalanced(xml,1,12,0,listBoxes(revision.categoryFlags,["Calidad del producto","Especificaciones / análisis","Acondicionamiento / envase","Etiquetado / documentación","Cantidad / contenido","Transporte / almacenamiento","Servicio / suministro","Equipo / sistema","Medio ambiente"],revision.categoryOther));
 xml=setWordCellTextBalanced(xml,1,13,0,text(r.description));
 xml=setWordCellTextBalanced(xml,1,14,1,`${box(r.recurrent===true,"Sí")}   ${box(r.recurrent===false,"No")}`);
 xml=setWordCellTextBalanced(xml,1,14,3,text(r.recurrenceReference));
 xml=setWordCellTextBalanced(xml,1,15,1,text(r.attachedDocumentation));
 xml=setWordCellTextBalanced(xml,1,16,1,text(r.emittedBy||r.createdByText));
 xml=setWordCellTextBalanced(xml,1,17,1,text(r.qaValidatedBy));

 const impacts=[
  revision.impactQualityGmp,
  revision.impactSafetyEfficacy,
  revision.impactRegulatory,
  revision.impactEnvironment,
  revision.impactOtherLots,
 ];
 impacts.forEach((value,index)=>{xml=setWordCellTextBalanced(xml,1,20+index,1,tri(value));});
 xml=setWordCellTextBalanced(xml,1,26,0,listBoxes(revision.containmentFlags,["Bloqueo / cuarentena","Suspender uso / distribución","Aviso a cliente / proveedor / titular / Autoridad","Ninguna"],revision.containmentOther));
 xml=setWordCellTextBalanced(xml,1,28,0,text(revision.riskJustification));

 xml=setWordCellTextBalanced(xml,1,31,0,[text(r.investigation),text(r.impactAssessment)].filter(Boolean).join("\n\n"));
 xml=setWordCellTextBalanced(xml,1,32,1,resultText(r.investigationResult));
 xml=setWordCellTextBalanced(xml,1,35,0,text(r.rootCause));

 xml=setWordCellTextBalanced(xml,1,37,0,classificationLine(r.classification,"CRITICAL","Crítica: riesgo grave / actuación inmediata."));
 xml=setWordCellTextBalanced(xml,1,38,0,classificationLine(r.classification,"MAJOR","Mayor: impacto relevante en calidad, GMP/regulatorio, lote, trazabilidad o suministro."));
 xml=setWordCellTextBalanced(xml,1,39,0,classificationLine(r.classification,"MINOR","Menor: impacto limitado sin efecto significativo en calidad, seguridad, eficacia o cumplimiento."));
 xml=setWordCellTextBalanced(xml,1,40,0,classificationLine(r.classification,"NO_GMP_IMPACT","Sin impacto GMP: comercial, logística o administrativa."));

 xml=setWordCellTextBalanced(xml,1,43,1,tri(revision.regulatoryMayRequireRecall));
 xml=setWordCellTextBalanced(xml,1,44,1,tri(revision.regulatoryActivateRecall));
 xml=setWordCellTextBalanced(xml,1,45,1,tri(revision.regulatoryAuthorityNotification));
 xml=setWordCellTextBalanced(xml,1,46,1,tri(revision.regulatoryResponsibleCommunication));
 xml=setWordCellTextBalanced(xml,1,47,1,text(revision.regulatoryJustification));

 xml=setWordCellTextBalanced(xml,1,50,0,text(r.resolutionLines));
 xml=setWordCellTextBalanced(xml,1,52,0,derivedFlags(r.resolutionActions,r.immediateActionDetails,r.otherResolutionDetails));
 xml=setWordCellTextBalanced(xml,1,52,1,derivedFlags(r.resolutionActions,r.immediateActionDetails,r.otherResolutionDetails));

 const actionRows=[
  ...revision.derivedActions.map(a=>[a.typeCode,a.actionEvidence,a.responsible,a.plannedDate?date(new Date(a.plannedDate)):""]),
  ...r.capaPlans.map(a=>[a.businessCapaCode??(a.actionType==="CORRECTIVE"?"CAPA correctiva":"CAPA preventiva"),a.description,text(a.responsible),date(a.plannedExecutionDate)]),
 ];
 if(actionRows.length){
  xml=replaceWordRowWithCopies(xml,1,55,actionRows);
 }

 xml=setWordCellTextBalanced(xml,1,57,1,[text(revision.communicationDate),text(revision.communicationMedium)].filter(Boolean).join(" / "));
 xml=setWordCellTextBalanced(xml,1,57,3,text(revision.communicationFromTo));
 xml=setWordCellTextBalanced(xml,1,59,0,text(r.externalCommunication));
 xml=setWordCellTextBalanced(xml,1,61,0,`${box(revision.partIOutcome==="CONTINUE_PART_II","Continúa en Parte II")}   ${box(revision.partIOutcome==="CLOSE_PART_I","Cierre en Parte I, sin seguimiento adicional")}`);
 xml=setWordCellTextBalanced(xml,1,63,0,text(r.conclusion));

 xml=setWordCellTextBalanced(xml,2,2,0,text(r.approvalNames));
 xml=setWordCellTextBalanced(xml,2,4,0,text(r.approvalNames));

 xml=setWordCellTextBalanced(xml,3,4,0,text(r.responseSummary));
 xml=setWordCellTextBalanced(xml,3,5,1,`${box(revision.responseSufficient===true,"Sí")}   ${box(revision.responseSufficient===false,"No")}`);
 xml=setWordCellTextBalanced(xml,3,7,0,box(r.effectivenessStatus==="ACCEPTABLE","Conforme"));
 xml=setWordCellTextBalanced(xml,3,7,1,box(r.effectivenessStatus==="NOT_ACCEPTABLE","No Conforme"));
 xml=setWordCellTextBalanced(xml,3,7,2,box(r.effectivenessStatus==="PENDING","Pendiente"));
 xml=setWordCellTextBalanced(xml,3,7,3,box(r.effectivenessStatus==="NOT_REQUIRED","N/A"));
 xml=setWordCellTextBalanced(xml,3,8,0,text(r.effectivenessAssessment));
 xml=setWordCellTextBalanced(xml,3,10,0,[
  box(revision.finalActionsStatus==="COMPLETED","Completadas"),
  box(revision.finalActionsStatus==="INDEPENDENT_FOLLOWUP","Vinculadas a seguimiento independiente"),
  box(revision.finalActionsStatus==="PENDING","Pendientes"),
  revision.finalActionsReferences?`Referencias / responsable: ${revision.finalActionsReferences}`:"",
 ].filter(Boolean).join("\n"));
 xml=setWordCellTextBalanced(xml,3,12,0,text(r.closeConclusion));
 xml=setWordCellTextBalanced(xml,3,13,1,`${box(r.status==="CLOSED","Cerrada")}   ${box(r.status!=="CLOSED","Abierta / en seguimiento")}`);
 xml=setWordCellTextBalanced(xml,3,13,3,date(r.closedAt));
 xml=setWordCellTextBalanced(xml,3,14,1,text(revision.nextFollowupDate));
 xml=setWordCellTextBalanced(xml,4,1,0,text(r.closeApprovalNames));

 updateZipEntry(entries,"word/document.xml",xml);
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}

export async function generateComplaintAnnexIV(_r:ComplaintDocumentRecord){
 throw new ComplaintTemplateUnavailableError("El Anexo IV (respuesta formal) no se genera desde la aplicación según el alcance acordado.");
}
