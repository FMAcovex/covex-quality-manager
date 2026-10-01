import { DocumentType } from "@prisma/client";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import {
  extractWordBodyRange,fillWordRowBalanced,
  replaceWordRowWithCopies,replaceWordRowsRangeBalanced,setWordCellTextBalanced
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintPntTemplate } from "@/modules/complaints/documents/templates";

type Capa={actionType:string;description:string;plannedExecutionDate:Date|null;responsible:string|null;businessCapaCode?:string|null};
type Derived={actionType:string;businessCode:string|null;description:string|null;responsible:string|null;plannedExecutionDate:Date|null};
type Followup={followupDate:Date;comment:string;nextFollowupDate:Date|null;evidenceReference:string|null};
export type ComplaintDocumentRecord={
 qmsRecord:{businessCode:string|null};openedAt:Date|null;detectionDate:Date|null;receptionDate:Date|null;detectedBy:string|null;complaintType:string;
 sourceTypes:string[];sourceOther:string|null;scopeTypes:string[];scopeOther:string|null;affectedObjectTypes:string[];affectedObjectOther:string|null;
 categoryTypes:string[];categoryOther:string|null;partyName:string|null;contact:string|null;affectedScope:string|null;reference:string|null;lotReference:string|null;
 quantity:string|null;expiryReanalysis:string|null;description:string|null;recurrent:boolean|null;
 recurrenceReference:string|null;attachedDocumentation:string|null;emittedBy:string|null;qaValidatedBy:string|null;investigation:string|null;impactAssessment:string|null;
 impactQualityGmp:string|null;impactSafetyEfficacy:string|null;impactRegulatory:string|null;impactEnvironment:string|null;impactOtherSimilar:string|null;
 containmentActions:string[];containmentOther:string|null;riskJustification:string|null;investigationResult:string|null;rootCause:string|null;classification:string|null;
 potentialRecall:string|null;recallProcedureRequired:string|null;authorityNotificationRequired:string|null;responsiblePartyCommunicationRequired:string|null;regulatoryJustification:string|null;
 resolutionLines:string|null;resolutionActions:string[];immediateActionDetails:string|null;
 recallActionDetails:string|null;creditActionDetails:string|null;replacementActionDetails:string|null;
 otherResolutionDetails:string|null;externalCommunication:string|null;communicationDate:Date|null;communicationMedium:string|null;communicationParties:string|null;communicationSummary:string|null;
 partIIRequired:boolean|null;conclusion:string|null;effectivenessRequired:boolean|null;approvalNames:string|null;
 responseDate:Date|null;responseMedium:string|null;responseSummary:string|null;responseSufficient:boolean|null;effectivenessStatus:string;effectivenessAssessment:string|null;
 closeActionStatus:string|null;closeActionReferences:string|null;closeConclusion:string|null;closeApprovalNames:string|null;closedAt:Date|null;internalObservations:string|null;
 capaPlans:Capa[];derivedActions:Derived[];followups:Followup[];
 annexIIITemplateVersion?:{versionCode:string}|null;annexIVTemplateVersion?:{versionCode:string}|null;annexVTemplateVersion?:{versionCode:string}|null;
};
const date=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const text=(v:string|null|undefined)=>v??"";
const box=(on:boolean,label:string)=>`${on?"☒":"☐"} ${label}`;
export function complaintClassificationMarks(value:string|null){
 return [
  value==="CRITICAL"?"☒":"☐",
  value==="MAJOR"?"☒":"☐",
  value==="MINOR"?"☒":"☐",
  value==="NO_GMP_IMPACT"?"☒":"☐",
 ];
}

const resolutionLabels:Record<string,string>={
 REJECT:"RECHAZO",
 REPROCESS:"REPROCESO",
 DISPOSE:"ELIMINACIÓN",
 KEEP_AS_IS:"MANTENER SITUACIÓN",
 SUPPLIER_INVESTIGATION:"INVESTIGACIÓN PROVEEDOR",
 SUPPLIER_EVALUATION:"EVALUACIÓN PROVEEDOR",
 OPEN_DEVIATION:"ABRIR DESVIACIÓN",
 OPEN_CAPA:"ABRIR CAPA",
 OPEN_CHANGE:"ABRIR CAMBIO",
};

export function complaintResolutionCells(r:Pick<ComplaintDocumentRecord,"resolutionActions"|"immediateActionDetails"|"recallActionDetails"|"creditActionDetails"|"replacementActionDetails"|"otherResolutionDetails">){
 const selected=new Set(r.resolutionActions);
 const explicit=new Set(["RETURN","CORRECTIVE_ACTION","PREVENTIVE_ACTION","IMMEDIATE_ACTION","RECALL","CREDIT","REPLACEMENT","OTHER"]);
 const extra=r.resolutionActions.filter(action=>!explicit.has(action)).map(action=>resolutionLabels[action]??action);
 const otherDetails=[...extra,text(r.otherResolutionDetails)].filter(Boolean).join(" · ");
 const withDetail=(action:string,label:string,detail:string|null|undefined)=>box(selected.has(action),selected.has(action)&&text(detail)?`${label}\n${text(detail)}`:label);
 const left=[
  box(selected.has("RETURN"),"DEVOLUCIÓN:"),
  box(selected.has("CORRECTIVE_ACTION"),"ACC. CORRECTORA:"),
  box(selected.has("PREVENTIVE_ACTION"),"ACC. PREVENTIVA:"),
  withDetail("IMMEDIATE_ACTION","ACC. INMEDIATA (especificar):",r.immediateActionDetails),
 ].join("\n");
 const right=[
  withDetail("RECALL","RETIRADA DEL MERCADO:",r.recallActionDetails),
  withDetail("CREDIT","ABONO:",r.creditActionDetails),
  withDetail("REPLACEMENT","REPOSICIÓN:",r.replacementActionDetails),
  box(selected.has("OTHER")||extra.length>0,selected.has("OTHER")||extra.length>0?`OTROS (especificar):\n${otherDetails}`:"OTROS (especificar):"),
 ].join("\n");
 return [left,right] as const;
}

export async function generateComplaintAnnexIII(r:ComplaintDocumentRecord){
 const version=r.annexIIITemplateVersion?.versionCode??"03";
 const entries=readZip(await loadComplaintPntTemplate(version,DocumentType.COMPLAINT_ANNEX_III));
 if(version!=="03"){
  let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo III", "Anexo IV:", "last");
  xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));
  xml=setWordCellTextBalanced(xml,1,1,1,date(r.detectionDate));xml=setWordCellTextBalanced(xml,1,1,3,text(r.detectedBy));
  xml=setWordCellTextBalanced(xml,1,2,1,box(r.complaintType==="PROVIDER","A PROVEEDOR"));xml=setWordCellTextBalanced(xml,1,2,2,box(r.complaintType==="CUSTOMER","DE CLIENTE"));
  xml=setWordCellTextBalanced(xml,1,3,1,text(r.partyName));xml=setWordCellTextBalanced(xml,1,4,1,text(r.contact));xml=setWordCellTextBalanced(xml,1,5,1,text(r.affectedScope));
  xml=setWordCellTextBalanced(xml,1,6,1,text(r.reference));xml=setWordCellTextBalanced(xml,1,6,3,text(r.lotReference));xml=setWordCellTextBalanced(xml,1,7,3,text(r.quantity));xml=setWordCellTextBalanced(xml,1,8,3,text(r.expiryReanalysis));
  xml=setWordCellTextBalanced(xml,1,10,0,text(r.description));xml=setWordCellTextBalanced(xml,1,11,1,`${box(r.recurrent===true,"Sí")}   ${box(r.recurrent===false,"No")}`);xml=setWordCellTextBalanced(xml,1,11,3,text(r.recurrenceReference));
  xml=setWordCellTextBalanced(xml,1,12,1,text(r.attachedDocumentation));xml=setWordCellTextBalanced(xml,1,13,1,text(r.emittedBy));xml=setWordCellTextBalanced(xml,1,14,1,text(r.qaValidatedBy));
  xml=setWordCellTextBalanced(xml,1,16,0,[text(r.investigation),text(r.impactAssessment)].filter(Boolean).join("\n\n"));
  xml=setWordCellTextBalanced(xml,2,1,0,text(r.rootCause));xml=setWordCellTextBalanced(xml,2,8,0,text(r.resolutionLines));
  xml=replaceWordRowWithCopies(xml,2,13,r.capaPlans.length?r.capaPlans.map(x=>[x.businessCapaCode??"",x.description,date(x.plannedExecutionDate),text(x.responsible)]):[["","","",""]]);
  xml=setWordCellTextBalanced(xml,3,1,0,text(r.conclusion));xml=setWordCellTextBalanced(xml,5,2,0,text(r.responseSummary));xml=setWordCellTextBalanced(xml,5,7,0,text(r.closeConclusion));
  updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
 }

 let xml=getZipEntryText(entries,"word/document.xml");
 const checks=(selected:string[],opts:Array<[string,string]>)=>opts.map(([k,l])=>box(selected.includes(k),l)).join("   ");
 const tri=(v:string|null,labelYes="Sí",labelNo="No")=>`${box(v==="YES",labelYes)}   ${box(v==="NO",labelNo)}   ${box(v==="NA","N/A")}`;
 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));
 xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));
 xml=setWordCellTextBalanced(xml,0,1,5,version);
 xml=setWordCellTextBalanced(xml,1,1,1,date(r.detectionDate));xml=setWordCellTextBalanced(xml,1,1,3,date(r.receptionDate));
 xml=setWordCellTextBalanced(xml,1,2,1,box(r.complaintType==="PROVIDER","A PROVEEDOR / SUBCONTRATA"));
 xml=setWordCellTextBalanced(xml,1,2,2,box(r.complaintType==="CUSTOMER","DE CLIENTE / AGENTE EXTERNO"));
 xml=setWordCellTextBalanced(xml,1,3,1,checks(r.sourceTypes,[["CUSTOMER","Cliente"],["DISTRIBUTOR","Distribuidor"],["MAH","Titular / MAH"],["CONSUMER","Consumidor / usuario"],["AUTHORITY","Autoridad"],["SUPPLIER","Proveedor"],["CARRIER","Transportista / operador logístico"],["SUBCONTRACTOR","Subcontrata"],["INTERNAL","Detección interna"],["RECALL","Retirada"],["OTHER","Otro"]]));
 xml=setWordCellTextBalanced(xml,1,4,1,[text(r.sourceOther),text(r.partyName)].filter(Boolean).join(" · "));
 xml=setWordCellTextBalanced(xml,1,5,1,text(r.contact));
 xml=setWordCellTextBalanced(xml,1,6,1,checks(r.scopeTypes,[["MEDICINE","Medicamento"],["API","API"],["SUPPLEMENT","Complemento alimenticio"],["COSMETIC","Cosmética"],["MEDICAL_DEVICE","Producto sanitario"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"]])+(r.scopeOther?`\nOtro: ${r.scopeOther}`:""));
 xml=setWordCellTextBalanced(xml,1,7,1,checks(r.affectedObjectTypes,[["PRODUCT_MATERIAL","Producto / material"],["SERVICE","Servicio"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["TRANSPORT","Transporte"],["SUBCONTRACTED_ACTIVITY","Actividad subcontratada"],["OTHER","Otro"]])+(r.affectedObjectOther?`\nOtro: ${r.affectedObjectOther}`:""));
 xml=setWordCellTextBalanced(xml,1,8,1,text(r.reference));xml=setWordCellTextBalanced(xml,1,8,3,text(r.lotReference));
 xml=setWordCellTextBalanced(xml,1,9,3,text(r.quantity));xml=setWordCellTextBalanced(xml,1,10,3,text(r.expiryReanalysis));
 xml=setWordCellTextBalanced(xml,1,12,0,`Categoría / motivo (selección múltiple): ${checks(r.categoryTypes,[["PRODUCT_QUALITY","Calidad del producto"],["SPECIFICATIONS_TESTING","Especificaciones / análisis"],["PACKAGING","Acondicionamiento / envase"],["LABELLING_DOCUMENTATION","Etiquetado / documentación"],["QUANTITY_CONTENT","Cantidad / contenido"],["TRANSPORT_STORAGE","Transporte / almacenamiento"],["SERVICE_SUPPLY","Servicio / suministro"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"]])}${r.categoryOther?` · ${r.categoryOther}`:""}`);
 xml=setWordCellTextBalanced(xml,1,13,0,text(r.description));
 xml=setWordCellTextBalanced(xml,1,14,1,`${box(r.recurrent===true,"Sí")}   ${box(r.recurrent===false,"No")}`);xml=setWordCellTextBalanced(xml,1,14,3,text(r.recurrenceReference));
 xml=setWordCellTextBalanced(xml,1,15,1,text(r.attachedDocumentation));xml=setWordCellTextBalanced(xml,1,16,1,text(r.emittedBy));xml=setWordCellTextBalanced(xml,1,17,1,text(r.qaValidatedBy));
 xml=setWordCellTextBalanced(xml,1,20,1,tri(r.impactQualityGmp));xml=setWordCellTextBalanced(xml,1,21,1,tri(r.impactSafetyEfficacy));
 xml=setWordCellTextBalanced(xml,1,22,1,tri(r.impactRegulatory));xml=setWordCellTextBalanced(xml,1,23,1,tri(r.impactEnvironment));xml=setWordCellTextBalanced(xml,1,24,1,tri(r.impactOtherSimilar));
 xml=setWordCellTextBalanced(xml,1,26,0,checks(r.containmentActions,[["QUARANTINE","Bloqueo / cuarentena"],["SUSPEND_USE_DISTRIBUTION","Suspender uso / distribución"],["NOTIFY_PARTIES","Aviso a partes"],["NONE","Ninguna"],["OTHER","Otra"]])+(r.containmentOther?` · ${r.containmentOther}`:""));
 xml=setWordCellTextBalanced(xml,1,28,0,text(r.riskJustification));
 xml=setWordCellTextBalanced(xml,1,31,0,[text(r.investigation),text(r.impactAssessment)].filter(Boolean).join("\n\n"));
 xml=setWordCellTextBalanced(xml,1,32,1,[box(r.investigationResult==="PROCEDENT","Procedente"),box(r.investigationResult==="NOT_PROCEDENT","No procedente"),box(r.investigationResult==="INCONCLUSIVE","No concluyente")].join("   "));
 xml=setWordCellTextBalanced(xml,1,35,0,text(r.rootCause));
 const classificationMarks=complaintClassificationMarks(r.classification);for(let i=0;i<4;i++)xml=setWordCellTextBalanced(xml,1,37+i,0,classificationMarks[i]);
 xml=setWordCellTextBalanced(xml,1,43,1,tri(r.potentialRecall));xml=setWordCellTextBalanced(xml,1,44,1,tri(r.recallProcedureRequired));
 xml=setWordCellTextBalanced(xml,1,45,1,tri(r.authorityNotificationRequired));xml=setWordCellTextBalanced(xml,1,46,1,tri(r.responsiblePartyCommunicationRequired));
 xml=setWordCellTextBalanced(xml,1,47,1,text(r.regulatoryJustification));xml=setWordCellTextBalanced(xml,1,50,0,text(r.resolutionLines));
 {const [left,right]=complaintResolutionCells(r);xml=setWordCellTextBalanced(xml,1,52,0,left);xml=setWordCellTextBalanced(xml,1,52,1,right);}
 xml=replaceWordRowWithCopies(xml,1,55,r.derivedActions.length?r.derivedActions.map(x=>[[x.actionType,x.businessCode].filter(Boolean).join(" / "),text(x.description),text(x.responsible),date(x.plannedExecutionDate)]):[["","","",""]]);
 xml=setWordCellTextBalanced(xml,1,57,1,[date(r.communicationDate),text(r.communicationMedium)].filter(Boolean).join(" / "));xml=setWordCellTextBalanced(xml,1,57,3,text(r.communicationParties));
 xml=setWordCellTextBalanced(xml,1,59,0,text(r.communicationSummary||r.externalCommunication));
 xml=setWordCellTextBalanced(xml,1,61,0,`${box(r.partIIRequired===true,"Continúa en Parte II")}   ${box(r.partIIRequired===false,"Cierre en Parte I, sin seguimiento adicional")}`);
 xml=setWordCellTextBalanced(xml,1,63,0,text(r.conclusion));
 xml=setWordCellTextBalanced(xml,2,2,0,text(r.approvalNames));
 xml=setWordCellTextBalanced(xml,3,4,0,text(r.responseSummary));xml=setWordCellTextBalanced(xml,3,5,1,`${box(r.responseSufficient===true,"Sí")}   ${box(r.responseSufficient===false,"No")}`);
 xml=setWordCellTextBalanced(xml,3,7,0,box(r.effectivenessStatus==="ACCEPTABLE","Conforme"));xml=setWordCellTextBalanced(xml,3,7,1,box(r.effectivenessStatus==="NOT_ACCEPTABLE","No conforme"));
 xml=setWordCellTextBalanced(xml,3,7,2,box(r.effectivenessStatus==="PENDING","Pendiente"));xml=setWordCellTextBalanced(xml,3,7,3,box(r.effectivenessStatus==="NOT_REQUIRED","N/A"));
 xml=setWordCellTextBalanced(xml,3,8,0,text(r.effectivenessAssessment));
 xml=setWordCellTextBalanced(xml,3,10,0,[r.closeActionStatus? `Estado de las acciones: ${r.closeActionStatus}`:"",text(r.closeActionReferences)].filter(Boolean).join("\n"));
 xml=setWordCellTextBalanced(xml,3,12,0,text(r.closeConclusion));xml=setWordCellTextBalanced(xml,3,13,1,`${box(Boolean(r.closedAt),"Cerrada")}   ${box(!r.closedAt,"Abierta / en seguimiento")}`);
 xml=setWordCellTextBalanced(xml,3,13,3,date(r.closedAt));xml=setWordCellTextBalanced(xml,3,14,1,date(r.followups[0]?.nextFollowupDate));
 xml=setWordCellTextBalanced(xml,4,1,0,text(r.closeApprovalNames));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateComplaintAnnexIV(r:ComplaintDocumentRecord){
 const entries=readZip(await loadComplaintPntTemplate(r.annexIVTemplateVersion?.versionCode??"02",DocumentType.COMPLAINT_ANNEX_IV));
 let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo IV:", "Anexo V:", "last");
 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));xml=setWordCellTextBalanced(xml,0,2,1,text(r.partyName));xml=setWordCellTextBalanced(xml,0,3,1,text(r.contact));
 xml=setWordCellTextBalanced(xml,0,4,1,text(r.reference));xml=setWordCellTextBalanced(xml,0,4,3,text(r.lotReference));xml=setWordCellTextBalanced(xml,0,5,3,text(r.quantity));xml=setWordCellTextBalanced(xml,0,6,3,text(r.expiryReanalysis));
 xml=setWordCellTextBalanced(xml,0,8,0,text(r.description));xml=setWordCellTextBalanced(xml,0,10,0,text(r.resolutionLines));{const [left,right]=complaintResolutionCells(r);xml=setWordCellTextBalanced(xml,0,12,0,left);xml=setWordCellTextBalanced(xml,0,12,1,right);}
 xml=setWordCellTextBalanced(xml,0,14,0,text(r.closeConclusion||r.conclusion));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateComplaintAnnexV(year:number,rows:ComplaintDocumentRecord[]){
 const entries=readZip(await loadComplaintPntTemplate("02",DocumentType.COMPLAINT_ANNEX_V));let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo V:",undefined,"last");
 xml=setWordCellTextBalanced(xml,0,1,0,`LISTADO DE RECLAMACIONES\n${year}`);
 xml=replaceWordRowsRangeBalanced(xml,0,4,9,({first})=>rows.map(r=>fillWordRowBalanced(first,[
  {text:text(r.qmsRecord.businessCode)},{text:r.complaintType==="PROVIDER"?"A proveedor":"De cliente"},{text:date(r.openedAt)},{text:text(r.partyName)},
  {text:text(r.reference||r.affectedScope)},{text:text(r.lotReference)},{text:r.classification==="CRITICAL"?"Crítica":r.classification==="MAJOR"?"Mayor":r.classification==="MINOR"?"Menor":r.classification==="NO_GMP_IMPACT"?"Sin impacto GMP":""},
  {text:r.closedAt?"Cerrada":"Abierta"},{text:date(r.closedAt)},{text:[r.internalObservations,...r.capaPlans.map(x=>x.businessCapaCode||x.description)].filter(Boolean).join(" · ")}
 ])));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}
