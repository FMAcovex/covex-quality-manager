import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { replaceWordRowRangeWithCopies,setWordCellText } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadChangeAnnexIII,loadChangeAnnexIV,loadChangeAnnexV } from "@/modules/change-control/documents/templates";

type ChangeDocumentRecord={
  qmsRecord:{businessCode:string|null};
  requestedAt:Date|null;
  requesterName:string|null;
  requesterPosition:string|null;
  scopes:string[];
  scopeOther:string|null;
  departmentCodeSnapshot:string|null;
  departmentNameSnapshot:string|null;
  description:string|null;
  justification:string|null;
  supportingDocuments:string|null;
  requestStatus:string;
  requestResponsible:string|null;
  acceptedByText:string|null;
  requestDecisionAt:Date|null;
  evaluation:string|null;
  classification:string|null;
  plannedImplementationAt:Date|null;
  committeeRequired:boolean|null;
  committeeJustification:string|null;
  clientNotificationRequired:boolean|null;
  clientNotificationDetail:string|null;
  authorityNotificationRequired:boolean|null;
  authorityNotificationDetail:string|null;
  pqrRequirement:string|null;
  pqrProducts:string|null;
  pqrPeriod:string|null;
  stabilityRequirement:string|null;
  stabilityAccelerated:boolean|null;
  stabilityOngoing:boolean|null;
  stabilityDetail:string|null;
  additionalAnalysis:string|null;
  additionalAnalysisDetail:string|null;
  additionalValidation:string|null;
  additionalValidationDetail:string|null;
  otherImplication:boolean|null;
  otherImplicationDetail:string|null;
  decisionResult:string;
  decisionAt:Date|null;
  followupResponsible:string|null;
  decisionObservations:string|null;
  approvedByText:string|null;
  executionStatus:string;
  executedAt:Date|null;
  effectivenessStatus:string;
  effectivenessObservations:string|null;
  status:string;
  closureConclusion:string|null;
  actions:Array<{
    departmentText:string|null;
    description:string;
    responsible:string|null;
    plannedExecutionDate:Date|null;
    actualExecutionDate:Date|null;
    completed:boolean;
    evidenceComment:string|null;
    introducedInSequence:number|null;
  }>;
  followups:Array<{
    sequenceNumber:number;
    followupDate:Date|null;
    responsibleText:string;
    observations:string|null;
    executionStatus:string;
    executionDate:Date|null;
    effectivenessStatus:string;
    effectivenessObservations:string|null;
    closesChange:boolean;
    nextFollowupDate:Date|null;
    openReason:string|null;
    conclusion:string|null;
    closedByText:string|null;
    closureApprovedByText:string|null;
  }>;
};

function date(value:Date|null|undefined){return value?new Intl.DateTimeFormat("es-ES").format(value):"";}
function yn(value:boolean|null|undefined){return value===true?"☒ Sí   ☐ No":value===false?"☐ Sí   ☒ No":"☐ Sí   ☐ No";}
function tri(value:string|null|undefined){
  return value==="YES"?"☒ Sí   ☐ No   ☐ No Aplica":
    value==="NO"?"☐ Sí   ☒ No   ☐ No Aplica":
      value==="NA"?"☐ Sí   ☐ No   ☒ No Aplica":"☐ Sí   ☐ No   ☐ No Aplica";
}
const scopeOrder=[
  ["FACILITIES","Instalaciones"],["EQUIPMENT","Equipos"],["PROCESS","Proceso"],
  ["MATERIAL","Material/MP"],["SUPPLIER","Proveedor"],["DOCUMENTATION","Documentación"],["OTHER","Otros"],
] as const;
function scopeText(record:ChangeDocumentRecord){
  return scopeOrder.map(([key,label])=>`${record.scopes.includes(key)?"☒":"☐"} ${label}`).join("   ")+
    (record.scopeOther?`\nEspecificar: ${record.scopeOther}`:"");
}
function department(record:ChangeDocumentRecord){
  if(record.departmentNameSnapshot&&record.departmentCodeSnapshot){
    return `${record.departmentNameSnapshot} (${record.departmentCodeSnapshot})`;
  }
  return record.departmentNameSnapshot??record.departmentCodeSnapshot??"";
}

export async function generateChangeAnnexIII(record:ChangeDocumentRecord,version="03") {
  const entries=readZip(await loadChangeAnnexIII(version));
  let xml=getZipEntryText(entries,"word/document.xml");
  xml=setWordCellText(xml,0,1,1,record.qmsRecord.businessCode??"");
  xml=setWordCellText(xml,0,1,3,date(record.requestedAt));
  xml=setWordCellText(xml,0,2,1,scopeText(record));
  xml=setWordCellText(xml,0,3,1,department(record));
  xml=setWordCellText(xml,0,5,0,[`Nombre y Apellido: ${record.requesterName??""}`,`Puesto: ${record.requesterPosition??""}`].join("\n"));
  xml=setWordCellText(xml,0,7,0,record.description??"");
  xml=setWordCellText(xml,0,9,0,record.justification??"");
  xml=setWordCellText(xml,0,11,0,record.supportingDocuments??"");
  const status=record.requestStatus==="ACCEPTED"?"☒ ACEPTADA          ☐ DENEGADA":
    record.requestStatus==="DENIED"?"☐ ACEPTADA          ☒ DENEGADA":"☐ ACEPTADA          ☐ DENEGADA";
  xml=setWordCellText(xml,0,13,1,status);
  xml=setWordCellText(xml,0,14,1,record.requestResponsible??"");
  xml=setWordCellText(xml,0,15,0,[
    `Nombre y cargo del responsable que acepta la solicitud: ${record.acceptedByText??""}`,
    `Fecha: ${date(record.requestDecisionAt)}`,
    "Firma: __________________",
  ].join("\n"));
  updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateChangeAnnexIV(record:ChangeDocumentRecord,version="03") {
  const entries=readZip(await loadChangeAnnexIV(version));
  let xml=getZipEntryText(entries,"word/document.xml");
  xml=setWordCellText(xml,0,1,1,record.qmsRecord.businessCode??"");
  xml=setWordCellText(xml,0,1,3,date(record.requestedAt));
  xml=setWordCellText(xml,0,2,1,scopeText(record));
  xml=setWordCellText(xml,0,3,1,department(record));
  xml=setWordCellText(xml,0,5,0,record.evaluation??"");
  xml=setWordCellText(xml,0,6,1,record.classification==="MAJOR"?"☒ MAYOR   ☐ MENOR":record.classification==="MINOR"?"☐ MAYOR   ☒ MENOR":"☐ MAYOR   ☐ MENOR");
  xml=setWordCellText(xml,0,6,3,date(record.plannedImplementationAt));
  if(record.actions.length){
    const rows=record.actions.map((action)=>[
      [action.departmentText,action.description].filter(Boolean).join("\n"),
      action.responsible??"",
      date(action.plannedExecutionDate),
    ]);
    xml=replaceWordRowRangeWithCopies(xml,1,2,1,12,rows);
  }
  const implications=[
    [yn(record.committeeRequired),record.committeeJustification??""],
    [yn(record.clientNotificationRequired),record.clientNotificationDetail??""],
    [yn(record.authorityNotificationRequired),record.authorityNotificationDetail??""],
    [tri(record.pqrRequirement),[`Producto(s): ${record.pqrProducts??""}`,`Periodo PQR: ${record.pqrPeriod??""}`].join("\n")],
    [tri(record.stabilityRequirement),[`Acelerada: ${record.stabilityAccelerated?"Sí":"No"}`,`En curso: ${record.stabilityOngoing?"Sí":"No"}`,record.stabilityDetail??""].filter(Boolean).join("\n")],
    [tri(record.additionalAnalysis),record.additionalAnalysisDetail??""],
    [tri(record.additionalValidation),record.additionalValidationDetail??""],
    [yn(record.otherImplication),record.otherImplicationDetail??""],
  ];
  implications.forEach((item,index)=>{xml=setWordCellText(xml,3,index,1,item[0]);xml=setWordCellText(xml,3,index,2,item[1]);});
  const result=record.decisionResult==="APPROVED"?"☒ APROBADO      ☐ RECHAZADO":record.decisionResult==="REJECTED"?"☐ APROBADO      ☒ RECHAZADO":"☐ APROBADO      ☐ RECHAZADO";
  xml=setWordCellText(xml,2,3,1,result);
  xml=setWordCellText(xml,2,3,3,date(record.decisionAt));
  xml=setWordCellText(xml,2,4,1,record.followupResponsible??"");
  xml=setWordCellText(xml,2,5,1,record.decisionObservations??"");
  xml=setWordCellText(xml,2,7,0,[`Nombre(s) y cargo(s): ${record.approvedByText??""}`,"Firma(s): ________________________________"].join("\n"));
  updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateChangeAnnexV(record:ChangeDocumentRecord,followupSequence:number,version="03") {
  const followup=record.followups.find((item)=>item.sequenceNumber===followupSequence);
  if(!followup) throw new Error("Seguimiento solicitado no encontrado.");
  const entries=readZip(await loadChangeAnnexV(version));
  let xml=getZipEntryText(entries,"word/document.xml");
  const history=record.followups
    .filter((item)=>item.sequenceNumber<=followupSequence)
    .sort((a,b)=>a.sequenceNumber-b.sequenceNumber)
    .map((item)=>`${String(item.sequenceNumber).padStart(2,"0")} (${date(item.followupDate)})`).join("\n");
  xml=setWordCellText(xml,0,1,1,record.qmsRecord.businessCode??"");
  xml=setWordCellText(xml,0,1,3,date(followup.followupDate));
  xml=setWordCellText(xml,0,2,0,String(followup.sequenceNumber).padStart(2,"0"));
  xml=setWordCellText(xml,0,2,1,`Historial de Seguimientos:\n${history}`);
  xml=setWordCellText(xml,0,3,0,`Responsable de Seguimiento: ${followup.responsibleText}`);

  const visibleActions=record.actions.filter((a)=>(a.introducedInSequence??0)<=followupSequence);
  if(visibleActions.length){
    const rows=visibleActions.map((action)=>[
      [action.departmentText,`${action.completed?"☒":"☐"} ${action.description}`].filter(Boolean).join("\n"),
      action.responsible??"",
      date(action.plannedExecutionDate),
      date(action.actualExecutionDate),
      action.evidenceComment??"",
    ]);
    xml=replaceWordRowWithCopies(xml,1,2,rows);
  }
  xml=setWordCellText(xml,2,1,0,followup.executionStatus==="EXECUTED"?"☒ EJECUTADO":"☐ EJECUTADO");
  xml=setWordCellText(xml,2,1,1,followup.executionStatus==="NOT_EXECUTED"?"☒ NO EJECUTADO":"☐ NO EJECUTADO");
  xml=setWordCellText(xml,2,2,1,date(followup.executionDate));
  xml=setWordCellText(xml,2,4,0,followup.effectivenessStatus==="ACCEPTABLE"?"☒ ACEPTABLE":"☐ ACEPTABLE");
  xml=setWordCellText(xml,2,4,1,followup.effectivenessStatus==="NOT_ACCEPTABLE"?"☒ NO ACEPTABLE":"☐ NO ACEPTABLE");
  xml=setWordCellText(xml,2,4,2,followup.effectivenessStatus==="PENDING"?"☒ PENDIENTE":"☐ PENDIENTE");
  xml=setWordCellText(xml,2,5,1,followup.effectivenessObservations??"");
  xml=setWordCellText(xml,2,7,0,followup.closesChange?"☒ SI":"☐ SI");
  xml=setWordCellText(xml,2,7,1,followup.closesChange?"☐ NO":"☒ NO");
  xml=setWordCellText(xml,2,7,4,date(followup.nextFollowupDate));
  xml=setWordCellText(xml,2,9,1,followup.openReason??"");
  xml=setWordCellText(xml,2,10,1,followup.conclusion??"");
  xml=setWordCellText(xml,2,11,0,[
    `Cierre del Seguimiento: ${followup.closedByText??""}`,
    `Aprobación y cierre del cambio: ${followup.closureApprovedByText??""}`,
  ].join("\n"));
  updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}
