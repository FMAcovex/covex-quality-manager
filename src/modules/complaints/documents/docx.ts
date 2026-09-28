import { DocumentType } from "@prisma/client";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import {
  extractWordBodyRange,fillWordRowBalanced,
  replaceWordRowWithCopies,replaceWordRowsRangeBalanced,setWordCellTextBalanced
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintPntTemplate } from "@/modules/complaints/documents/templates";

type Capa={actionType:string;description:string;plannedExecutionDate:Date|null;responsible:string|null;businessCapaCode?:string|null};
type Followup={followupDate:Date;comment:string;nextFollowupDate:Date|null;evidenceReference:string|null};
export type ComplaintDocumentRecord={
 qmsRecord:{businessCode:string|null};openedAt:Date|null;detectionDate:Date|null;detectedBy:string|null;complaintType:string;partyName:string|null;contact:string|null;
 affectedScope:string|null;reference:string|null;lotReference:string|null;quantity:string|null;expiryReanalysis:string|null;description:string|null;recurrent:boolean|null;
 recurrenceReference:string|null;attachedDocumentation:string|null;emittedBy:string|null;qaValidatedBy:string|null;investigation:string|null;impactAssessment:string|null;
 investigationResult:string|null;rootCause:string|null;classification:string|null;resolutionLines:string|null;resolutionActions:string[];immediateActionDetails:string|null;
 otherResolutionDetails:string|null;externalCommunication:string|null;conclusion:string|null;effectivenessRequired:boolean|null;approvalNames:string|null;
 responseDate:Date|null;responseMedium:string|null;responseSummary:string|null;effectivenessStatus:string;effectivenessAssessment:string|null;closeConclusion:string|null;
 closeApprovalNames:string|null;closedAt:Date|null;internalObservations:string|null;capaPlans:Capa[];followups:Followup[];
 annexIIITemplateVersion?:{versionCode:string}|null;annexIVTemplateVersion?:{versionCode:string}|null;annexVTemplateVersion?:{versionCode:string}|null;
};
const date=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const text=(v:string|null|undefined)=>v??"";
const box=(on:boolean,label:string)=>`${on?"☒":"☐"} ${label}`;
function implications(r:ComplaintDocumentRecord){
 const s=new Set(r.resolutionActions);
 return [
  box(s.has("RETURN"),"DEVOLUCIÓN"),box(s.has("CORRECTIVE_ACTION"),"ACC. CORRECTORA"),box(s.has("PREVENTIVE_ACTION"),"ACC. PREVENTIVA"),
  box(s.has("IMMEDIATE_ACTION"),`ACC. INMEDIATA ${text(r.immediateActionDetails)}`),box(s.has("RECALL"),"RETIRADA DEL MERCADO"),
  box(s.has("CREDIT"),"ABONO"),box(s.has("REPLACEMENT"),"REPOSICIÓN"),box(s.has("REJECT"),"RECHAZO"),box(s.has("REPROCESS"),"REPROCESO"),
  box(s.has("DISPOSE"),"ELIMINACIÓN"),box(s.has("KEEP_AS_IS"),"MANTENER SITUACIÓN"),box(s.has("SUPPLIER_INVESTIGATION"),"INVESTIGACIÓN PROVEEDOR"),
  box(s.has("SUPPLIER_EVALUATION"),"EVALUACIÓN PROVEEDOR"),box(s.has("OPEN_DEVIATION"),"ABRIR DESVIACIÓN"),box(s.has("OPEN_CAPA"),"ABRIR CAPA"),
  box(s.has("OPEN_CHANGE"),"ABRIR CAMBIO"),box(s.has("OTHER"),`OTROS ${text(r.otherResolutionDetails)}`)
 ].join("\n");
}
function extractAnnexOrWhole(
 documentXml:string,
 startMarker:string,
 endMarker?:string,
 startOccurrence:"first"|"last"="last",
){
 try{return extractWordBodyRange(documentXml,startMarker,endMarker,startOccurrence);}
 catch(error){
  if(error instanceof Error&&error.message.includes("Word annex start marker not found"))return documentXml;
  throw error;
 }
}

function classificationText(v:string|null){
 return [
  box(v==="CRITICAL","Crítica: Riesgo grave para paciente/usuario, posible retirada, bloqueo/rechazo de lote o impacto regulatorio."),
  box(v==="MAJOR","Mayor: Posible impacto en calidad, cumplimiento GMP, lote, suministro o documentación esencial."),
  box(v==="MINOR","Menor: Sin impacto crítico en calidad/seguridad/eficacia; impacto limitado o administrativo."),
  box(v==="NO_GMP_IMPACT","Sin impacto GMP: Reclamación comercial, logística o administrativa sin impacto en calidad.")
 ];
}

export async function generateComplaintAnnexIII(r:ComplaintDocumentRecord){
 const entries=readZip(await loadComplaintPntTemplate(r.annexIIITemplateVersion?.versionCode??"02",DocumentType.COMPLAINT_ANNEX_III));
 let xml=extractAnnexOrWhole(getZipEntryText(entries,"word/document.xml"),"Anexo III", "Anexo IV:", "last");
 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));
 xml=setWordCellTextBalanced(xml,1,1,1,date(r.detectionDate));xml=setWordCellTextBalanced(xml,1,1,3,text(r.detectedBy));
 xml=setWordCellTextBalanced(xml,1,2,1,box(r.complaintType==="PROVIDER","A PROVEEDOR"));xml=setWordCellTextBalanced(xml,1,2,2,box(r.complaintType==="CUSTOMER","DE CLIENTE"));
 xml=setWordCellTextBalanced(xml,1,3,1,text(r.partyName));xml=setWordCellTextBalanced(xml,1,4,1,text(r.contact));xml=setWordCellTextBalanced(xml,1,5,1,text(r.affectedScope));
 xml=setWordCellTextBalanced(xml,1,6,1,text(r.reference));xml=setWordCellTextBalanced(xml,1,6,3,text(r.lotReference));xml=setWordCellTextBalanced(xml,1,7,3,text(r.quantity));xml=setWordCellTextBalanced(xml,1,8,3,text(r.expiryReanalysis));
 xml=setWordCellTextBalanced(xml,1,10,0,text(r.description));xml=setWordCellTextBalanced(xml,1,11,1,`${box(r.recurrent===true,"Sí")}   ${box(r.recurrent===false,"No")}`);xml=setWordCellTextBalanced(xml,1,11,3,text(r.recurrenceReference));
 xml=setWordCellTextBalanced(xml,1,12,1,text(r.attachedDocumentation));xml=setWordCellTextBalanced(xml,1,13,1,text(r.emittedBy));xml=setWordCellTextBalanced(xml,1,14,1,text(r.qaValidatedBy));
 xml=setWordCellTextBalanced(xml,1,16,0,[text(r.investigation),text(r.impactAssessment)].filter(Boolean).join("\n\n"));
 xml=setWordCellTextBalanced(xml,1,17,1,box(r.investigationResult==="PROCEDENT","PROCEDENTE"));xml=setWordCellTextBalanced(xml,1,17,2,box(r.investigationResult==="NOT_PROCEDENT","NO PROCEDENTE"));
 xml=setWordCellTextBalanced(xml,1,18,1,box(r.investigationResult==="INCONCLUSIVE","NO CONCLUYENTE"));xml=setWordCellTextBalanced(xml,1,18,2,box(r.investigationResult==="NOT_ATTRIBUTABLE_TO_COVEX","NO ATRIBUIBLE A COVEX"));
 xml=setWordCellTextBalanced(xml,2,1,0,text(r.rootCause));
 const cls=classificationText(r.classification);for(let i=0;i<4;i++)xml=setWordCellTextBalanced(xml,2,3+i,0,cls[i]);
 xml=setWordCellTextBalanced(xml,2,8,0,text(r.resolutionLines));xml=setWordCellTextBalanced(xml,2,10,0,implications(r));xml=setWordCellTextBalanced(xml,2,10,1,"");
 xml=replaceWordRowWithCopies(xml,2,13,r.capaPlans.length?r.capaPlans.map(x=>[x.businessCapaCode??"",x.description,date(x.plannedExecutionDate),text(x.responsible)]):[["","","",""]]);
 xml=setWordCellTextBalanced(xml,2,15,0,text(r.externalCommunication));xml=setWordCellTextBalanced(xml,3,1,0,text(r.conclusion));
 xml=setWordCellTextBalanced(xml,3,2,1,`${box(r.effectivenessRequired===true,"Sí")}   ${box(r.effectivenessRequired===false,"No")}`);
 xml=setWordCellTextBalanced(xml,4,2,0,text(r.approvalNames));
 xml=setWordCellTextBalanced(xml,5,2,0,[r.responseDate?`Fecha: ${date(r.responseDate)}`:"",r.responseMedium?`Medio: ${r.responseMedium}`:"",text(r.responseSummary)].filter(Boolean).join("\n"));
 xml=setWordCellTextBalanced(xml,5,4,0,text(r.effectivenessAssessment));
 xml=setWordCellTextBalanced(xml,5,5,0,box(r.effectivenessStatus==="ACCEPTABLE","ACEPTABLE"));xml=setWordCellTextBalanced(xml,5,5,1,box(r.effectivenessStatus==="NOT_ACCEPTABLE","NO ACEPTABLE"));
 xml=setWordCellTextBalanced(xml,5,5,2,`${box(r.effectivenessStatus==="PENDING","PENDIENTE")}\n${box(r.effectivenessStatus==="NOT_REQUIRED","NO REQUERIDA")}`);
 xml=setWordCellTextBalanced(xml,5,7,0,text(r.closeConclusion));xml=setWordCellTextBalanced(xml,6,2,0,text(r.closeApprovalNames));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateComplaintAnnexIV(r:ComplaintDocumentRecord){
 const entries=readZip(await loadComplaintPntTemplate(r.annexIVTemplateVersion?.versionCode??"02",DocumentType.COMPLAINT_ANNEX_IV));
 let xml=extractAnnexOrWhole(getZipEntryText(entries,"word/document.xml"),"Anexo IV:", "Anexo V:", "last");
 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));xml=setWordCellTextBalanced(xml,0,2,1,text(r.partyName));xml=setWordCellTextBalanced(xml,0,3,1,text(r.contact));
 xml=setWordCellTextBalanced(xml,0,4,1,text(r.reference));xml=setWordCellTextBalanced(xml,0,4,3,text(r.lotReference));xml=setWordCellTextBalanced(xml,0,5,3,text(r.quantity));xml=setWordCellTextBalanced(xml,0,6,3,text(r.expiryReanalysis));
 xml=setWordCellTextBalanced(xml,0,8,0,text(r.description));xml=setWordCellTextBalanced(xml,0,10,0,text(r.resolutionLines));xml=setWordCellTextBalanced(xml,0,12,0,implications(r));xml=setWordCellTextBalanced(xml,0,12,1,"");
 xml=setWordCellTextBalanced(xml,0,14,0,text(r.closeConclusion||r.conclusion));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateComplaintAnnexV(year:number,rows:ComplaintDocumentRecord[]){
 const entries=readZip(await loadComplaintPntTemplate("02",DocumentType.COMPLAINT_ANNEX_V));let xml=extractAnnexOrWhole(getZipEntryText(entries,"word/document.xml"),"Anexo V:",undefined,"last");
 xml=setWordCellTextBalanced(xml,0,1,0,`LISTADO DE RECLAMACIONES\n${year}`);
 xml=replaceWordRowsRangeBalanced(xml,0,4,9,({first})=>rows.map(r=>fillWordRowBalanced(first,[
  {text:text(r.qmsRecord.businessCode)},{text:r.complaintType==="PROVIDER"?"A proveedor":"De cliente"},{text:date(r.openedAt)},{text:text(r.partyName)},
  {text:text(r.reference||r.affectedScope)},{text:text(r.lotReference)},{text:r.classification==="CRITICAL"?"Crítica":r.classification==="MAJOR"?"Mayor":r.classification==="MINOR"?"Menor":r.classification==="NO_GMP_IMPACT"?"Sin impacto GMP":""},
  {text:r.closedAt?"Cerrada":"Abierta"},{text:date(r.closedAt)},{text:[r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")}
 ])));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}
