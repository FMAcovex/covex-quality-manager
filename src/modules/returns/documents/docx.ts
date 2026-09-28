import { DocumentType } from "@prisma/client";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { extractWordBodyRange,fillWordRowBalanced,replaceWordRowWithCopies,replaceWordRowsRangeBalanced,setWordCellTextBalanced } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadReturnPntTemplate } from "@/modules/returns/documents/templates";

type Product={id:string;productType:string;productNameCode:string;format:string|null;lot:string|null;expiryReanalysis:string|null;quantity:string|null;unit:string|null;netWeight:string|null;grossWeight:string|null;receptionObservations:string|null;receivedBy:string|null;receivedByDate:Date|null;verifiedBy:string|null;verifiedByDate:Date|null};
type Followup={followupDate:Date;comment:string;nextFollowupDate:Date|null;evidenceReference:string|null};
export type ReturnDocumentRecord={
 qmsRecord:{businessCode:string|null};communicationDate:Date|null;receivedAt:Date|null;returnType:string;otherReturnType:string|null;customerEntity:string|null;country:string|null;address:string|null;
 relatedDocument:string|null;conservationConditions:string|null;deliveryNote:string|null;reasonObservations:string|null;attachedDocumentation:string|null;
 withinAcceptedReturnPeriod:string|null;roomTemperatureWithinTenDays:string|null;coldChainWithinFortyEightHours:string|null;uniqueIdentifierActive:string|null;tamperEvidenceIntact:string|null;
 packagingIntegrityOk:string|null;customerDeclarationAvailable:string|null;customerDeclarationSignatoryName:string|null;customerDeclarationSignatoryRole:string|null;customerDeclarationSignedAt:Date|null;customerDeclarationObservations:string|null;
 storageTransportConditionsOk:string|null;noUseDamageContamination:string|null;noRecallAlertBlock:string|null;expiryAcceptable:string|null;
 qcAssessmentCompleted:string|null;storageTemperatureRecord:string|null;returnTransportTempEvidence:string|null;transportPackagingSuitable:string|null;receiptTemperatureAcceptable:string|null;temperatureExcursionEvaluated:string|null;coldChainReturnSystemValidated:string|null;
 decision:string;finalDestination:string|null;decisionObservations:string|null;qaApprovalName:string|null;technicalApprovalName:string|null;decisionDate:Date|null;destructionManagedBy:string|null;destructionCertificate:string|null;traceabilityUpdated:string|null;internalObservations:string|null;
 products:Product[];followups:Followup[];annexIIITemplateVersion?:{versionCode:string}|null;annexIVTemplateVersion?:{versionCode:string}|null;annexVTemplateVersion?:{versionCode:string}|null;annexVITemplateVersion?:{versionCode:string}|null;
};
const date=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const text=(v:string|null|undefined)=>v??"";
const tri=(v:string|null|undefined)=>v==="YES"?"Sí":v==="NO"?"No":v==="NA"?"N.A.":"";
const box=(on:boolean,label:string)=>`${on?"☒":"☐"} ${label}`;
const typeLabel=(v:string,o:string|null)=>v==="COMMERCIAL"?"Comercial":v==="COMPLAINT"?"Reclamación":v==="RECALL"?"Retirada":v==="EXPIRY"?"Caducidad":v==="TRANSPORT"?"Transporte":o||"Otra";
const productType=(v:string)=>({API:"API",INTERMEDIATE:"Intermedio",MEDICINE:"Medicamento",SUPPLEMENT:"Complemento alimenticio",IMPORTED_PRODUCT:"Producto importado",MEDICAL_DEVICE:"Producto sanitario",COSMETIC:"Cosmético",OTHER:"Otro"} as Record<string,string>)[v]??v;

export async function generateReturnAnnexIII(r:ReturnDocumentRecord){
 const version=r.annexIIITemplateVersion?.versionCode??"03";
 const entries=readZip(await loadReturnPntTemplate(version,DocumentType.RETURN_ANNEX_III));
 let xml=getZipEntryText(entries,"word/document.xml");
 if(version!=="03")xml=extractWordBodyRange(xml,"Anexo III:", "Anexo IV:", "last");
 xml=setWordCellTextBalanced(xml,1,0,1,text(r.qmsRecord.businessCode));xml=setWordCellTextBalanced(xml,1,0,3,date(r.communicationDate));xml=setWordCellTextBalanced(xml,1,1,1,date(r.receivedAt));
 xml=setWordCellTextBalanced(xml,1,1,3,[box(r.returnType==="COMMERCIAL","Comercial"),box(r.returnType==="COMPLAINT","Reclamación"),box(r.returnType==="RECALL","Retirada"),box(r.returnType==="EXPIRY","Caducidad"),box(r.returnType==="TRANSPORT","Transporte"),box(r.returnType==="OTHER",`Otra: ${text(r.otherReturnType)}`)].join("   "));
 xml=setWordCellTextBalanced(xml,1,2,1,text(r.customerEntity));xml=setWordCellTextBalanced(xml,1,2,3,text(r.country));xml=setWordCellTextBalanced(xml,1,3,1,text(r.address));xml=setWordCellTextBalanced(xml,1,4,1,text(r.relatedDocument));
 xml=setWordCellTextBalanced(xml,2,0,1,[...new Set(r.products.map(x=>productType(x.productType)))].join(" · "));xml=setWordCellTextBalanced(xml,2,1,1,text(r.conservationConditions));xml=setWordCellTextBalanced(xml,2,1,3,text(r.deliveryNote));
 xml=replaceWordRowWithCopies(xml,3,1,r.products.map(x=>[x.productNameCode,text(x.format),text(x.lot),text(x.expiryReanalysis),[x.quantity,x.unit].filter(Boolean).join(" ")]));
 xml=setWordCellTextBalanced(xml,4,0,0,[text(r.reasonObservations),r.attachedDocumentation?`Documentación: ${r.attachedDocumentation}`:""].filter(Boolean).join("\n\n"));
 const checks=[r.withinAcceptedReturnPeriod,r.roomTemperatureWithinTenDays,r.coldChainWithinFortyEightHours,r.uniqueIdentifierActive,r.tamperEvidenceIntact,r.packagingIntegrityOk,r.customerDeclarationAvailable,r.storageTransportConditionsOk,r.noUseDamageContamination,r.noRecallAlertBlock,r.expiryAcceptable,r.qcAssessmentCompleted];
 checks.forEach((v,i)=>{xml=setWordCellTextBalanced(xml,5,i+1,1,tri(v));});
 const cold=[r.storageTemperatureRecord,r.returnTransportTempEvidence,r.transportPackagingSuitable,r.receiptTemperatureAcceptable,r.temperatureExcursionEvaluated,r.coldChainReturnSystemValidated];
 cold.forEach((v,i)=>{xml=setWordCellTextBalanced(xml,6,i+1,1,tri(v));});
 xml=setWordCellTextBalanced(xml,7,0,0,`${box(r.decision==="ACCEPTED","Aceptada")}    ${box(r.decision==="REJECTED","Rechazada")}`);
 xml=setWordCellTextBalanced(xml,7,1,1,[text(r.finalDestination),text(r.decisionObservations),r.decisionDate?`Fecha decisión: ${date(r.decisionDate)}`:""].filter(Boolean).join("\n"));
 xml=setWordCellTextBalanced(xml,8,1,0,text(r.qaApprovalName));xml=setWordCellTextBalanced(xml,8,1,1,text(r.technicalApprovalName));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateReturnAnnexIV(r:ReturnDocumentRecord,product:Product){
 const version=r.annexIVTemplateVersion?.versionCode??"03";
 const entries=readZip(await loadReturnPntTemplate(version,DocumentType.RETURN_ANNEX_IV));
 let xml=getZipEntryText(entries,"word/document.xml");
 if(version!=="03")xml=extractWordBodyRange(xml,"Anexo IV:", "Anexo V:", "last");
 xml=setWordCellTextBalanced(xml,0,1,0,`FECHA RECEPCIÓN: ${date(r.receivedAt)}`);
 xml=setWordCellTextBalanced(xml,0,2,0,`CÓDIGO DEVOLUCIÓN: ${text(r.qmsRecord.businessCode)}\nPRODUCTO: ${product.productNameCode}\nLOTE: ${text(product.lot)}`);
 xml=setWordCellTextBalanced(xml,0,3,0,`CLIENTE: ${text(r.customerEntity)}\nPAÍS: ${text(r.country)}`);
 xml=setWordCellTextBalanced(xml,0,4,0,`CANTIDAD: ${[product.quantity,product.unit].filter(Boolean).join(" ")}\nPESO NETO: ${text(product.netWeight)}\nPESO BRUTO: ${text(product.grossWeight)}`);
 xml=setWordCellTextBalanced(xml,0,5,0,`OBSERVACIONES: ${text(product.receptionObservations)}`);
 xml=setWordCellTextBalanced(xml,0,6,0,`RECIBIDO POR: ${text(product.receivedBy)}\nFECHA: ${date(product.receivedByDate||r.receivedAt)}`);xml=setWordCellTextBalanced(xml,0,6,1,`VERIFICADO POR: ${text(product.verifiedBy)}\nFECHA: ${date(product.verifiedByDate||r.receivedAt)}`);
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateReturnAnnexV(r:ReturnDocumentRecord){
 const version=r.annexVTemplateVersion?.versionCode??"03";
 const entries=readZip(await loadReturnPntTemplate(version,DocumentType.RETURN_ANNEX_V));
 let xml=getZipEntryText(entries,"word/document.xml");
 if(version!=="03")xml=extractWordBodyRange(xml,"Anexo V:", "Anexo VI:", "last");
 xml=setWordCellTextBalanced(xml,1,0,1,text(r.customerEntity));xml=setWordCellTextBalanced(xml,1,1,1,date(r.communicationDate));xml=setWordCellTextBalanced(xml,1,1,3,text(r.qmsRecord.businessCode));
 xml=setWordCellTextBalanced(xml,1,2,1,r.products.map(x=>x.productNameCode).join(" · "));xml=setWordCellTextBalanced(xml,1,2,3,r.products.map(x=>text(x.lot)).filter(Boolean).join(" · "));xml=setWordCellTextBalanced(xml,1,3,1,text(r.conservationConditions));
 xml=setWordCellTextBalanced(xml,3,0,0,text(r.reasonObservations));xml=setWordCellTextBalanced(xml,4,0,1,text(r.customerDeclarationObservations));
 xml=setWordCellTextBalanced(xml,5,0,1,[text(r.customerDeclarationSignatoryName),text(r.customerDeclarationSignatoryRole),date(r.customerDeclarationSignedAt)].filter(Boolean).join(" / "));
 xml=setWordCellTextBalanced(xml,5,1,1,text(r.qaApprovalName));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateReturnAnnexVI(year:number,records:ReturnDocumentRecord[]){
 const entries=readZip(await loadReturnPntTemplate("03",DocumentType.RETURN_ANNEX_VI));let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo VI:",undefined,"last");
 xml=setWordCellTextBalanced(xml,0,2,0,String(year));
 const rows=records.flatMap(r=>r.products.map(p=>[
  text(r.qmsRecord.businessCode),date(r.communicationDate),text(r.relatedDocument)||typeLabel(r.returnType,r.otherReturnType),text(r.customerEntity),p.productNameCode,text(p.format),text(p.lot),
  [p.quantity,p.unit].filter(Boolean).join(" "),text(p.expiryReanalysis),text(r.country),text(r.destructionManagedBy),text(r.destructionCertificate),
  [r.internalObservations,...r.followups.map(f=>`${date(f.followupDate)}: ${f.comment}`)].filter(Boolean).join(" · ")
 ]));
 xml=replaceWordRowsRangeBalanced(xml,0,5,17,({first})=>rows.map(values=>fillWordRowBalanced(first,values.map(v=>({text:v})))));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}
