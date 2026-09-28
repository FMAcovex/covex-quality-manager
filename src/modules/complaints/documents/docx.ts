import { DocumentType } from "@prisma/client";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import {
  appendWordCellTextBalanced,extractWordBodyRange,fillWordRowBalanced,
  replaceWordRowWithCopies,replaceWordRowsRangeBalanced,setWordCellTextBalanced,setWordSdtCheckbox
} from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadComplaintPntTemplate } from "@/modules/complaints/documents/templates";

type Capa={actionType:string;description:string;plannedExecutionDate:Date|null;responsible:string|null;businessCapaCode?:string|null};
type Followup={followupDate:Date;comment:string;nextFollowupDate:Date|null;evidenceReference:string|null};
type DerivedAction={typeCode:string;actionEvidence:string|null;responsible:string|null;plannedDate:Date|null};
export type ComplaintDocumentRecord={
 qmsRecord:{businessCode:string|null};openedAt:Date|null;detectionDate:Date|null;receivedAt:Date|null;detectedBy:string|null;complaintType:string;
 detectionSources:string[];otherDetectionSource:string|null;scopeCategories:string[];otherScopeCategory:string|null;affectedObjects:string[];otherAffectedObject:string|null;
 complaintCategories:string[];otherComplaintCategory:string|null;partyName:string|null;contact:string|null;
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
function classificationText(v:string|null){
 return [
  box(v==="CRITICAL","Crítica: Riesgo grave para paciente/usuario, posible retirada, bloqueo/rechazo de lote o impacto regulatorio."),
  box(v==="MAJOR","Mayor: Posible impacto en calidad, cumplimiento GMP, lote, suministro o documentación esencial."),
  box(v==="MINOR","Menor: Sin impacto crítico en calidad/seguridad/eficacia; impacto limitado o administrativo."),
  box(v==="NO_GMP_IMPACT","Sin impacto GMP: Reclamación comercial, logística o administrativa sin impacto en calidad.")
 ];
}

async function generateComplaintAnnexIIIv02(r:ComplaintDocumentRecord){
 const entries=readZip(await loadComplaintPntTemplate(r.annexIIITemplateVersion?.versionCode??"02",DocumentType.COMPLAINT_ANNEX_III));
 let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo III", "Anexo IV:", "last");
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


function setRowBool(xml:string,table:number,row:number,value:boolean|null){
 xml=setWordSdtCheckbox(xml,table,row,0,value===true);
 xml=setWordSdtCheckbox(xml,table,row,1,value===false);
 return xml;
}
function setRowTri(xml:string,table:number,row:number,value:string|null){
 xml=setWordSdtCheckbox(xml,table,row,0,value==="YES");
 xml=setWordSdtCheckbox(xml,table,row,1,value==="NO");
 xml=setWordSdtCheckbox(xml,table,row,2,value==="NA");
 return xml;
}
function setCheckboxSet(xml:string,table:number,row:number,ordered:string[],selected:string[]){
 const set=new Set(selected);
 ordered.forEach((key,index)=>{xml=setWordSdtCheckbox(xml,table,row,index,set.has(key));});
 return xml;
}

async function generateComplaintAnnexIIIv03(r:ComplaintDocumentRecord){
 const entries=readZip(await loadComplaintPntTemplate("03",DocumentType.COMPLAINT_ANNEX_III));
 let xml=getZipEntryText(entries,"word/document.xml");
 const version=r.annexIIITemplateVersion?.versionCode??"03";
 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));
 xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));
 xml=setWordCellTextBalanced(xml,0,1,5,version);

 xml=setWordCellTextBalanced(xml,1,1,1,date(r.detectionDate));
 xml=setWordCellTextBalanced(xml,1,1,3,date(r.receivedAt));
 xml=setWordSdtCheckbox(xml,1,2,0,r.complaintType==="PROVIDER");
 xml=setWordSdtCheckbox(xml,1,2,1,r.complaintType==="CUSTOMER");

 xml=setCheckboxSet(xml,1,3,["CLIENT","DISTRIBUTOR","MAH","CONSUMER","AUTHORITY","SUPPLIER","LOGISTICS","SUBCONTRACTOR","INTERNAL","RECALL","OTHER"],r.detectionSources);
 xml=setWordCellTextBalanced(xml,1,4,1,text(r.otherDetectionSource));
 xml=setWordCellTextBalanced(xml,1,5,1,text(r.contact));
 xml=setCheckboxSet(xml,1,6,["MEDICINE","API","SUPPLEMENT","COSMETIC","MEDICAL_DEVICE","ENVIRONMENT","OTHER"],r.scopeCategories);
 if(r.otherScopeCategory)xml=appendWordCellTextBalanced(xml,1,6,1,"Otro: "+r.otherScopeCategory);
 xml=setCheckboxSet(xml,1,7,["PRODUCT_MATERIAL","SERVICE","EQUIPMENT_SYSTEM","TRANSPORT","SUBCONTRACTED_ACTIVITY","OTHER"],r.affectedObjects);
 if(r.otherAffectedObject)xml=appendWordCellTextBalanced(xml,1,7,1,"Otro: "+r.otherAffectedObject);
 xml=setWordCellTextBalanced(xml,1,8,1,text(r.reference));
 xml=setWordCellTextBalanced(xml,1,8,3,text(r.lotReference));
 xml=setWordCellTextBalanced(xml,1,9,3,text(r.quantity));
 xml=setWordCellTextBalanced(xml,1,10,3,text(r.expiryReanalysis));
 xml=setCheckboxSet(xml,1,12,["PRODUCT_QUALITY","SPECIFICATIONS_ANALYSIS","PACKAGING_CONTAINER","LABEL_DOCUMENTATION","QUANTITY_CONTENT","TRANSPORT_STORAGE","SERVICE_SUPPLY","EQUIPMENT_SYSTEM","ENVIRONMENT","OTHER"],r.complaintCategories);
 if(r.otherComplaintCategory)xml=appendWordCellTextBalanced(xml,1,12,0,"Otro: "+r.otherComplaintCategory);
 xml=setWordCellTextBalanced(xml,1,13,0,text(r.description));
 xml=setWordSdtCheckbox(xml,1,14,0,r.recurrent===true);
 xml=setWordSdtCheckbox(xml,1,14,1,r.recurrent===false);
 xml=setWordCellTextBalanced(xml,1,14,3,text(r.recurrenceReference));
 xml=setWordCellTextBalanced(xml,1,15,1,text(r.attachedDocumentation));
 xml=setWordCellTextBalanced(xml,1,16,1,text(r.emittedBy));
 xml=setWordCellTextBalanced(xml,1,17,1,text(r.qaValidatedBy));

 xml=setRowBool(xml,1,20,r.impactQualityGmp);
 xml=setRowBool(xml,1,21,r.impactSafetyEfficacy);
 xml=setRowBool(xml,1,22,r.impactRegulatory);
 xml=setRowBool(xml,1,23,r.impactEnvironment);
 xml=setRowBool(xml,1,24,r.impactOtherSimilar);
 xml=setCheckboxSet(xml,1,26,["BLOCK_QUARANTINE","SUSPEND_USE_DISTRIBUTION","NOTIFY_STAKEHOLDERS","NONE","OTHER"],r.containmentActions);
 if(r.otherContainmentAction)xml=appendWordCellTextBalanced(xml,1,26,0,"Otra: "+r.otherContainmentAction);
 xml=setWordCellTextBalanced(xml,1,28,0,text(r.containmentJustification));
 const investigation=[text(r.investigation),text(r.impactAssessment),r.investigationResult==="NOT_ATTRIBUTABLE_TO_COVEX"?"Resultado adicional: No atribuible a COVEX":""].filter(Boolean).join("\n\n");
 xml=setWordCellTextBalanced(xml,1,31,0,investigation);
 xml=setWordSdtCheckbox(xml,1,32,0,r.investigationResult==="PROCEDENT");
 xml=setWordSdtCheckbox(xml,1,32,1,r.investigationResult==="NOT_PROCEDENT");
 xml=setWordSdtCheckbox(xml,1,32,2,r.investigationResult==="INCONCLUSIVE");
 xml=setWordCellTextBalanced(xml,1,35,0,text(r.rootCause));

 ([["CRITICAL",37],["MAJOR",38],["MINOR",39],["NO_GMP_IMPACT",40]] as Array<[string,number]>).forEach(([value,row])=>{
   xml=setWordSdtCheckbox(xml,1,row,0,r.classification===value);
 });
 xml=setRowTri(xml,1,43,r.recallPotential);
 xml=setRowTri(xml,1,44,r.recallProcedureRequired);
 xml=setRowTri(xml,1,45,r.authorityNotificationRequired);
 xml=setRowTri(xml,1,46,r.responsibleClientCommunicationRequired);
 xml=setWordCellTextBalanced(xml,1,47,1,text(r.regulatoryJustification));
 xml=setWordCellTextBalanced(xml,1,50,0,text(r.resolutionLines));

 const actions=new Set(r.resolutionActions);
 ["RETURN","CORRECTIVE_ACTION","PREVENTIVE_ACTION","IMMEDIATE_ACTION","RECALL","CREDIT","REPLACEMENT","OTHER"].forEach((key,index)=>{
   xml=setWordSdtCheckbox(xml,1,52,index,actions.has(key));
 });
 if(r.immediateActionDetails)xml=appendWordCellTextBalanced(xml,1,52,0,"Acción inmediata: "+r.immediateActionDetails);
 if(r.otherResolutionDetails)xml=appendWordCellTextBalanced(xml,1,52,1,"Otros: "+r.otherResolutionDetails);

 xml=replaceWordRowWithCopies(xml,1,55,r.derivedActions.length?r.derivedActions.map(a=>[
   text(a.typeCode),text(a.actionEvidence),text(a.responsible),date(a.plannedDate)
 ]):[["","","",""]]);

 xml=setWordCellTextBalanced(xml,1,57,1,[date(r.communicationDate),text(r.communicationMedium)].filter(Boolean).join(" · "));
 xml=setWordCellTextBalanced(xml,1,57,3,text(r.communicationSenderRecipient));
 xml=setWordCellTextBalanced(xml,1,59,0,text(r.communicationSummary||r.externalCommunication));
 xml=setWordSdtCheckbox(xml,1,61,0,r.continueToPartII===true);
 xml=setWordSdtCheckbox(xml,1,61,1,r.continueToPartII===false);
 xml=setWordCellTextBalanced(xml,1,63,0,text(r.conclusion));

 xml=setWordCellTextBalanced(xml,2,2,0,text(r.approvalNames));
 xml=setWordCellTextBalanced(xml,2,4,0,text(r.qaValidatedBy));

 xml=setWordCellTextBalanced(xml,3,4,0,text(r.responseSummary));
 xml=setWordSdtCheckbox(xml,3,5,0,r.responseSufficient===true);
 xml=setWordSdtCheckbox(xml,3,5,1,r.responseSufficient===false);
 xml=setWordSdtCheckbox(xml,3,7,0,r.effectivenessStatus==="ACCEPTABLE");
 xml=setWordSdtCheckbox(xml,3,7,1,r.effectivenessStatus==="NOT_ACCEPTABLE");
 xml=setWordSdtCheckbox(xml,3,7,2,r.effectivenessStatus==="PENDING");
 xml=setWordSdtCheckbox(xml,3,7,3,r.effectivenessStatus==="NOT_REQUIRED");
 xml=setWordCellTextBalanced(xml,3,8,0,text(r.effectivenessAssessment));
 xml=setWordSdtCheckbox(xml,3,10,0,r.closureActionStatus==="COMPLETED");
 xml=setWordSdtCheckbox(xml,3,10,1,r.closureActionStatus==="LINKED");
 xml=setWordSdtCheckbox(xml,3,10,2,r.closureActionStatus==="PENDING");
 if(r.closureActionReferences||r.closureActionResponsible){
   xml=appendWordCellTextBalanced(xml,3,10,0,[
     r.closureActionReferences?"Referencias: "+r.closureActionReferences:"",
     r.closureActionResponsible?"Responsable: "+r.closureActionResponsible:""
   ].filter(Boolean).join(" · "));
 }
 xml=setWordCellTextBalanced(xml,3,12,0,text(r.closeConclusion));
 xml=setWordSdtCheckbox(xml,3,13,0,r.status==="CLOSED");
 xml=setWordSdtCheckbox(xml,3,13,1,r.status==="OPEN");
 xml=setWordCellTextBalanced(xml,3,13,3,date(r.closedAt));
 xml=setWordCellTextBalanced(xml,3,14,1,date(r.followups[0]?.nextFollowupDate??null));
 xml=setWordCellTextBalanced(xml,4,1,0,text(r.closeApprovalNames));

 updateZipEntry(entries,"word/document.xml",xml);
 sanitizeOfficeMetadata(entries);
 return writeZip(entries);
}

export async function generateComplaintAnnexIII(r:ComplaintDocumentRecord){
 const version=r.annexIIITemplateVersion?.versionCode??"02";
 return version==="03"?generateComplaintAnnexIIIv03(r):generateComplaintAnnexIIIv02(r);
}

export async function generateComplaintAnnexIV(r:ComplaintDocumentRecord){
 const entries=readZip(await loadComplaintPntTemplate(r.annexIVTemplateVersion?.versionCode??"02",DocumentType.COMPLAINT_ANNEX_IV));
 let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo IV:", "Anexo V:", "last");
 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));xml=setWordCellTextBalanced(xml,0,2,1,text(r.partyName));xml=setWordCellTextBalanced(xml,0,3,1,text(r.contact));
 xml=setWordCellTextBalanced(xml,0,4,1,text(r.reference));xml=setWordCellTextBalanced(xml,0,4,3,text(r.lotReference));xml=setWordCellTextBalanced(xml,0,5,3,text(r.quantity));xml=setWordCellTextBalanced(xml,0,6,3,text(r.expiryReanalysis));
 xml=setWordCellTextBalanced(xml,0,8,0,text(r.description));xml=setWordCellTextBalanced(xml,0,10,0,text(r.resolutionLines));xml=setWordCellTextBalanced(xml,0,12,0,implications(r));xml=setWordCellTextBalanced(xml,0,12,1,"");
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
