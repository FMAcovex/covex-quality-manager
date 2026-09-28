import { DocumentType } from "@prisma/client";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import {
  extractWordBodyRange,fillWordRowBalanced,
  appendWordCellTextBalanced,replaceWordRowWithCopies,replaceWordRowsRangeBalanced,setWordCellTextBalanced
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
 closeApprovalNames:string|null;closedAt:Date|null;internalObservations:string|null;extraData?:unknown;capaPlans:Capa[];followups:Followup[];
 annexIIITemplateVersion?:{versionCode:string}|null;annexIVTemplateVersion?:{versionCode:string}|null;annexVTemplateVersion?:{versionCode:string}|null;
};
const date=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const text=(v:string|null|undefined)=>v??"";
const box=(on:boolean,label:string)=>`${on?"☒":"☐"} ${label}`;
const asObject=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const asStrings=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[];
const asString=(v:unknown)=>typeof v==="string"?v:"";
const asBool=(v:unknown)=>v===true?true:v===false?false:null;
const complaintV03=(r:ComplaintDocumentRecord)=>asObject(asObject(r.extraData).complaintV03);
const triBox=(value:unknown)=>`${box(value==="YES","Sí")}   ${box(value==="NO","No")}${value==="NA"?"   ☒ N/A":"   ☐ N/A"}`;
const yesNoBox=(value:unknown)=>`${box(value==="YES","Sí")}   ${box(value==="NO","No")}`;
const checkedList=(selected:string[],options:Array<[string,string]>,other?:string)=>options.map(([value,label])=>box(selected.includes(value),label)).join("   ")+(other?`\nOtro: ${other}`:"");
const v03Origins:Array<[string,string]>=[
 ["CUSTOMER","Cliente"],["DISTRIBUTOR","Distribuidor"],["MAH","Titular / MAH"],["CONSUMER_USER","Consumidor / usuario"],
 ["AUTHORITY","Autoridad / entidad sanitaria"],["PROVIDER","Proveedor"],["LOGISTICS","Transportista / operador logístico"],
 ["SUBCONTRACTOR","Subcontrata"],["INTERNAL","Detección interna"],["RECALL","Retirada"],["OTHER","Otro"],
];
const v03Scopes:Array<[string,string]>=[
 ["MEDICINE","Medicamento"],["API","API"],["SUPPLEMENT","Complemento alimenticio"],["COSMETIC","Cosmética"],
 ["MEDICAL_DEVICE","Producto sanitario"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"],
];
const v03Affected:Array<[string,string]>=[
 ["PRODUCT_MATERIAL","Producto / material"],["SERVICE","Servicio"],["EQUIPMENT_SYSTEM","Equipo / sistema"],
 ["TRANSPORT","Transporte"],["SUBCONTRACTED_ACTIVITY","Actividad subcontratada"],["OTHER","Otro"],
];
const v03Categories:Array<[string,string]>=[
 ["PRODUCT_QUALITY","Calidad del producto"],["SPEC_ANALYSIS","Especificaciones / análisis"],["PACKAGING","Acondicionamiento / envase"],
 ["LABEL_DOCUMENTATION","Etiquetado / documentación"],["QUANTITY_CONTENT","Cantidad / contenido"],["TRANSPORT_STORAGE","Transporte / almacenamiento"],
 ["SERVICE_SUPPLY","Servicio / suministro"],["EQUIPMENT_SYSTEM","Equipo / sistema"],["ENVIRONMENT","Medio ambiente"],["OTHER","Otro"],
];
const v03Containment:Array<[string,string]>=[
 ["BLOCK_QUARANTINE","Bloqueo / cuarentena"],["SUSPEND_USE","Suspender uso / distribución"],["NOTIFY_CUSTOMER","Aviso a cliente"],
 ["NOTIFY_PROVIDER","Aviso a proveedor"],["NOTIFY_MAH","Aviso a titular / MAH"],["NOTIFY_AUTHORITY","Aviso a autoridad"],
 ["NONE","Ninguna"],["OTHER","Otra"],
];
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

async function generateComplaintAnnexIIIV03(r:ComplaintDocumentRecord){
 const entries=readZip(await loadComplaintPntTemplate("03",DocumentType.COMPLAINT_ANNEX_III));
 let xml=getZipEntryText(entries,"word/document.xml");
 const v=complaintV03(r);
 const origins=asStrings(v.origins),scopes=asStrings(v.scopes),affected=asStrings(v.affectedItems),categories=asStrings(v.categoryReasons),containment=asStrings(v.containmentActions);
 const derived=Array.isArray(v.derivedActions)?v.derivedActions.map(asObject):[];

 xml=setWordCellTextBalanced(xml,0,1,1,text(r.qmsRecord.businessCode));
 xml=setWordCellTextBalanced(xml,0,1,3,date(r.openedAt));
 xml=setWordCellTextBalanced(xml,0,1,5,"03");

 xml=setWordCellTextBalanced(xml,1,1,1,date(r.detectionDate));
 xml=setWordCellTextBalanced(xml,1,1,3,date(r.openedAt));
 xml=setWordCellTextBalanced(xml,1,2,1,box(r.complaintType==="PROVIDER","A PROVEEDOR / SUBCONTRATA"));
 xml=setWordCellTextBalanced(xml,1,2,2,box(r.complaintType==="CUSTOMER","DE CLIENTE / AGENTE EXTERNO"));
 xml=setWordCellTextBalanced(xml,1,3,1,checkedList(origins,v03Origins));
 xml=setWordCellTextBalanced(xml,1,4,1,asString(v.originOther));
 xml=setWordCellTextBalanced(xml,1,5,1,text(r.contact));
 xml=setWordCellTextBalanced(xml,1,6,1,checkedList(scopes,v03Scopes));
 xml=setWordCellTextBalanced(xml,1,7,1,checkedList(affected,v03Affected));
 xml=setWordCellTextBalanced(xml,1,8,1,text(r.reference));
 xml=setWordCellTextBalanced(xml,1,8,3,text(r.lotReference));
 xml=setWordCellTextBalanced(xml,1,9,3,text(r.quantity));
 xml=setWordCellTextBalanced(xml,1,10,3,text(r.expiryReanalysis));
 xml=setWordCellTextBalanced(xml,1,12,0,checkedList(categories,v03Categories));
 xml=setWordCellTextBalanced(xml,1,13,0,text(r.description));
 xml=setWordCellTextBalanced(xml,1,14,1,`${box(r.recurrent===true,"Sí")}   ${box(r.recurrent===false,"No")}`);
 xml=setWordCellTextBalanced(xml,1,14,3,text(r.recurrenceReference));
 xml=setWordCellTextBalanced(xml,1,15,1,text(r.attachedDocumentation));
 xml=setWordCellTextBalanced(xml,1,16,1,text(r.emittedBy));
 xml=setWordCellTextBalanced(xml,1,17,1,text(r.qaValidatedBy));

 xml=setWordCellTextBalanced(xml,1,20,1,yesNoBox(v.impactQualityGmp));
 xml=setWordCellTextBalanced(xml,1,21,1,yesNoBox(v.impactSafetyEfficacyUser));
 xml=setWordCellTextBalanced(xml,1,22,1,yesNoBox(v.impactRegulatory));
 xml=setWordCellTextBalanced(xml,1,23,1,yesNoBox(v.impactEnvironmental));
 xml=setWordCellTextBalanced(xml,1,24,1,yesNoBox(v.similarOtherLots));
 xml=setWordCellTextBalanced(xml,1,26,0,checkedList(containment,v03Containment,asString(v.containmentOther)));
 xml=setWordCellTextBalanced(xml,1,28,0,asString(v.riskScopeJustification)||text(r.impactAssessment));
 xml=setWordCellTextBalanced(xml,1,31,0,text(r.investigation));
 const result=r.investigationResult;
 xml=setWordCellTextBalanced(xml,1,32,1,[
   box(result==="PROCEDENT","Procedente"),
   box(result==="NOT_PROCEDENT"||result==="NOT_ATTRIBUTABLE_TO_COVEX",result==="NOT_ATTRIBUTABLE_TO_COVEX"?"No procedente (no atribuible a COVEX)":"No procedente"),
   box(result==="INCONCLUSIVE","No concluyente"),
 ].join("   "));
 xml=setWordCellTextBalanced(xml,1,35,0,text(r.rootCause));
 if(r.classification==="CRITICAL")xml=appendWordCellTextBalanced(xml,1,37,0,"☒ CLASIFICACIÓN SELECCIONADA");
 if(r.classification==="MAJOR")xml=appendWordCellTextBalanced(xml,1,38,0,"☒ CLASIFICACIÓN SELECCIONADA");
 if(r.classification==="MINOR")xml=appendWordCellTextBalanced(xml,1,39,0,"☒ CLASIFICACIÓN SELECCIONADA");
 if(r.classification==="NO_GMP_IMPACT")xml=appendWordCellTextBalanced(xml,1,40,0,"☒ CLASIFICACIÓN SELECCIONADA");

 xml=setWordCellTextBalanced(xml,1,43,1,triBox(v.mayRequireRecall));
 xml=setWordCellTextBalanced(xml,1,44,1,triBox(v.activateRecall));
 xml=setWordCellTextBalanced(xml,1,45,1,triBox(v.authorityNotification));
 xml=setWordCellTextBalanced(xml,1,46,1,triBox(v.mahClientCommunication));
 xml=setWordCellTextBalanced(xml,1,47,1,asString(v.regulatoryJustification));
 xml=setWordCellTextBalanced(xml,1,50,0,text(r.resolutionLines));
 xml=setWordCellTextBalanced(xml,1,52,0,implications(r));
 xml=setWordCellTextBalanced(xml,1,52,1,"");
 xml=replaceWordRowWithCopies(xml,1,55,derived.length?derived.map(x=>[
   asString(x.typeCode),asString(x.actionEvidence),asString(x.responsible),asString(x.plannedDate)
 ]):[["","","",""]]);
 xml=setWordCellTextBalanced(xml,1,57,1,[asString(v.communicationDate),asString(v.communicationMedium)].filter(Boolean).join(" · "));
 xml=setWordCellTextBalanced(xml,1,57,3,asString(v.communicationSenderRecipient));
 xml=setWordCellTextBalanced(xml,1,59,0,asString(v.communicationSummary)||text(r.externalCommunication));
 const continuePartII=asBool(v.continuePartII);
 xml=setWordCellTextBalanced(xml,1,61,0,`${box(continuePartII===true,"Continúa en Parte II")}   ${box(continuePartII===false,"Cierre en Parte I, sin seguimiento adicional")}`);
 xml=setWordCellTextBalanced(xml,1,63,0,asString(v.partIConclusionPendings)||text(r.conclusion));
 xml=setWordCellTextBalanced(xml,2,2,0,text(r.approvalNames));

 xml=setWordCellTextBalanced(xml,3,4,0,text(r.responseSummary));
 xml=setWordCellTextBalanced(xml,3,5,1,yesNoBox(v.responseSufficient));
 xml=setWordCellTextBalanced(xml,3,7,0,box(r.effectivenessStatus==="ACCEPTABLE","Conforme"));
 xml=setWordCellTextBalanced(xml,3,7,1,box(r.effectivenessStatus==="NOT_ACCEPTABLE","No Conforme"));
 xml=setWordCellTextBalanced(xml,3,7,2,box(r.effectivenessStatus==="PENDING","Pendiente"));
 xml=setWordCellTextBalanced(xml,3,7,3,box(r.effectivenessStatus==="NOT_REQUIRED","N/A"));
 xml=setWordCellTextBalanced(xml,3,8,0,text(r.effectivenessAssessment));
 xml=setWordCellTextBalanced(xml,3,10,0,asString(v.actionStateSummary));
 xml=setWordCellTextBalanced(xml,3,12,0,text(r.closeConclusion));
 xml=setWordCellTextBalanced(xml,3,13,1,`${box(Boolean(r.closedAt),"Cerrada")}   ${box(!r.closedAt,"Abierta / en seguimiento")}`);
 xml=setWordCellTextBalanced(xml,3,13,3,date(r.closedAt));
 xml=setWordCellTextBalanced(xml,3,14,1,asString(v.nextFollowupDate));
 xml=setWordCellTextBalanced(xml,4,1,0,text(r.closeApprovalNames));

 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateComplaintAnnexIII(r:ComplaintDocumentRecord){
 const version=r.annexIIITemplateVersion?.versionCode??"02";
 if(version==="03")return generateComplaintAnnexIIIV03(r);
 const entries=readZip(await loadComplaintPntTemplate(version,DocumentType.COMPLAINT_ANNEX_III));
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
