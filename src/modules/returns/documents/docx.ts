import { DocumentType } from "@prisma/client";
import { getZipEntryText,readZip,updateZipEntry,writeZip } from "@/lib/ooxml/zip";
import { extractWordBodyRange,replaceWordRowWithCopies,setWordCellTextBalanced } from "@/lib/ooxml/xml";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { loadReturnTemplate } from "@/modules/returns/documents/templates";

type Product={id:string;productType:string;productNameCode:string;format:string|null;lot:string|null;expiryReanalysis:string|null;quantity:string|null;unit:string|null;netWeight:string|null;grossWeight:string|null;receptionObservations:string|null;receivedBy:string|null;verifiedBy:string|null};
type Followup={followupDate:Date;comment:string;nextFollowupDate:Date|null;evidenceReference:string|null};
export type ReturnDocumentRecord={
 qmsRecord:{businessCode:string|null};communicationDate:Date|null;receivedAt:Date|null;returnType:string;otherReturnType:string|null;customerEntity:string|null;country:string|null;address:string|null;
 relatedDocument:string|null;conservationConditions:string|null;deliveryNote:string|null;reasonObservations:string|null;attachedDocumentation:string|null;
 withinAcceptedReturnPeriod:string|null;roomTemperatureWithinTenDays:string|null;coldChainWithinFortyEightHours:string|null;uniqueIdentifierActive:string|null;tamperEvidenceIntact:string|null;
 packagingIntegrityOk:string|null;customerDeclarationAvailable:string|null;customerDeclarationSigner:string|null;customerDeclarationSignerRole:string|null;customerDeclarationDate:Date|null;customerEvidenceTypes:string[];customerEvidenceOther:string|null;customerDeclarationObservations:string|null;storageTransportConditionsOk:string|null;noUseDamageContamination:string|null;noRecallAlertBlock:string|null;expiryAcceptable:string|null;
 qcAssessmentCompleted:string|null;storageTemperatureRecord:string|null;returnTransportTempEvidence:string|null;transportPackagingSuitable:string|null;receiptTemperatureAcceptable:string|null;temperatureExcursionEvaluated:string|null;coldChainReturnSystemValidated:string|null;
 decision:string;finalDestination:string|null;decisionObservations:string|null;qaApprovalName:string|null;technicalApprovalName:string|null;decisionDate:Date|null;destructionManagedBy:string|null;destructionCertificate:string|null;traceabilityUpdated:string|null;internalObservations:string|null;
 products:Product[];followups:Followup[];annexIIITemplateVersion?:{versionCode:string}|null;annexIVTemplateVersion?:{versionCode:string}|null;annexVTemplateVersion?:{versionCode:string}|null;annexVITemplateVersion?:{versionCode:string}|null;
};
const date=(v:Date|null|undefined)=>v?new Intl.DateTimeFormat("es-ES").format(v):"";
const text=(v:string|null|undefined)=>v??"";
const tri=(v:string|null|undefined)=>v==="YES"?"Sí":v==="NO"?"No":v==="NA"?"N.A.":"";
const box=(on:boolean,label:string)=>`${on?"☒":"☐"} ${label}`;
const productType=(v:string)=>({API:"API",INTERMEDIATE:"Intermedio",MEDICINE:"Medicamento",SUPPLEMENT:"Complemento alimenticio",IMPORTED_PRODUCT:"Producto importado",MEDICAL_DEVICE:"Producto sanitario",COSMETIC:"Cosmético",OTHER:"Otro"} as Record<string,string>)[v]??v;

export async function generateReturnAnnexIII(r:ReturnDocumentRecord){
 const entries=readZip(await loadReturnTemplate(r.annexIIITemplateVersion?.versionCode??"03",DocumentType.RETURN_ANNEX_III));
 let xml=getZipEntryText(entries,"word/document.xml");
 xml=setWordCellTextBalanced(xml,1,0,1,text(r.qmsRecord.businessCode));
 xml=setWordCellTextBalanced(xml,1,0,3,date(r.communicationDate));
 xml=setWordCellTextBalanced(xml,1,1,1,date(r.receivedAt));
 xml=setWordCellTextBalanced(xml,1,1,3,[box(r.returnType==="COMMERCIAL","Comercial"),box(r.returnType==="COMPLAINT","Reclamación"),box(r.returnType==="RECALL","Retirada"),box(r.returnType==="EXPIRY","Caducidad"),box(r.returnType==="TRANSPORT","Transporte"),box(r.returnType==="OTHER",`Otra: ${text(r.otherReturnType)}`)].join("   "));
 xml=setWordCellTextBalanced(xml,1,2,1,text(r.customerEntity));xml=setWordCellTextBalanced(xml,1,2,3,text(r.country));
 xml=setWordCellTextBalanced(xml,1,3,1,text(r.address));xml=setWordCellTextBalanced(xml,1,4,1,text(r.relatedDocument));
 xml=setWordCellTextBalanced(xml,2,0,1,[...new Set(r.products.map(x=>productType(x.productType)))].join(" · "));
 xml=setWordCellTextBalanced(xml,2,1,1,text(r.conservationConditions));xml=setWordCellTextBalanced(xml,2,1,3,text(r.deliveryNote));
 xml=replaceWordRowWithCopies(xml,3,1,r.products.map(x=>[x.productNameCode,text(x.format),text(x.lot),text(x.expiryReanalysis),[x.quantity,x.unit].filter(Boolean).join(" ")]));
 xml=setWordCellTextBalanced(xml,4,0,0,[text(r.reasonObservations),r.attachedDocumentation?`Documentación: ${r.attachedDocumentation}`:""].filter(Boolean).join("\n\n"));
 const checks=[r.withinAcceptedReturnPeriod,r.roomTemperatureWithinTenDays,r.coldChainWithinFortyEightHours,r.uniqueIdentifierActive,r.tamperEvidenceIntact,r.packagingIntegrityOk,r.customerDeclarationAvailable,r.storageTransportConditionsOk,r.noUseDamageContamination,r.noRecallAlertBlock,r.expiryAcceptable,r.qcAssessmentCompleted];
 checks.forEach((v,i)=>{xml=setWordCellTextBalanced(xml,5,i+1,1,tri(v));});
 const cold=[r.storageTemperatureRecord,r.returnTransportTempEvidence,r.transportPackagingSuitable,r.receiptTemperatureAcceptable,r.temperatureExcursionEvaluated,r.coldChainReturnSystemValidated];
 cold.forEach((v,i)=>{xml=setWordCellTextBalanced(xml,6,i+1,1,tri(v));});
 xml=setWordCellTextBalanced(xml,7,0,0,`${box(r.decision==="ACCEPTED","Aceptada")}    ${box(r.decision==="REJECTED","Rechazada")}`);
 xml=setWordCellTextBalanced(xml,7,1,0,[text(r.finalDestination),text(r.decisionObservations),r.decisionDate?`Fecha decisión: ${date(r.decisionDate)}`:""].filter(Boolean).join("\n"));
 xml=setWordCellTextBalanced(xml,8,1,0,text(r.qaApprovalName));xml=setWordCellTextBalanced(xml,8,1,1,text(r.technicalApprovalName));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateReturnAnnexIV(r:ReturnDocumentRecord,product:Product){
 const entries=readZip(await loadReturnTemplate(r.annexIVTemplateVersion?.versionCode??"03",DocumentType.RETURN_ANNEX_IV));let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo IV:", "Anexo V:", "last");
 xml=setWordCellTextBalanced(xml,0,1,0,`FECHA RECEPCIÓN: ${date(r.receivedAt)}`);
 xml=setWordCellTextBalanced(xml,0,2,0,`CÓDIGO DEVOLUCIÓN: ${text(r.qmsRecord.businessCode)}\nPRODUCTO: ${product.productNameCode}\nLOTE: ${text(product.lot)}`);
 xml=setWordCellTextBalanced(xml,0,3,0,`CLIENTE: ${text(r.customerEntity)}\nPAÍS: ${text(r.country)}`);
 xml=setWordCellTextBalanced(xml,0,4,0,`CANTIDAD: ${[product.quantity,product.unit].filter(Boolean).join(" ")}\nPESO NETO: ${text(product.netWeight)}\nPESO BRUTO: ${text(product.grossWeight)}`);
 xml=setWordCellTextBalanced(xml,0,5,0,`OBSERVACIONES: ${text(product.receptionObservations)}`);
 xml=setWordCellTextBalanced(xml,0,6,0,`RECIBIDO POR: ${text(product.receivedBy)}\nFECHA: ${date(r.receivedAt)}`);xml=setWordCellTextBalanced(xml,0,6,1,`VERIFICADO POR: ${text(product.verifiedBy)}\nFECHA: ${date(r.receivedAt)}`);
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

export async function generateReturnAnnexV(r:ReturnDocumentRecord){
 const entries=readZip(await loadReturnTemplate(r.annexVTemplateVersion?.versionCode??"03",DocumentType.RETURN_ANNEX_V));
 let xml=extractWordBodyRange(getZipEntryText(entries,"word/document.xml"),"Anexo V:", "Anexo VI:", "last");
 xml=setWordCellTextBalanced(xml,1,0,1,text(r.customerEntity));xml=setWordCellTextBalanced(xml,1,1,1,date(r.communicationDate));xml=setWordCellTextBalanced(xml,1,1,3,text(r.qmsRecord.businessCode));
 xml=setWordCellTextBalanced(xml,1,2,1,r.products.map(x=>x.productNameCode).join(" · "));xml=setWordCellTextBalanced(xml,1,2,3,r.products.map(x=>text(x.lot)).filter(Boolean).join(" · "));
 xml=setWordCellTextBalanced(xml,1,3,1,text(r.conservationConditions));
 xml=setWordCellTextBalanced(xml,2,0,0,`D./D.ª ${text(r.customerDeclarationSigner)}, en calidad de ${text(r.customerDeclarationSignerRole)}, DECLARA las condiciones de conservación indicadas.`);
 const ev=new Set(r.customerEvidenceTypes);
 xml=setWordCellTextBalanced(xml,3,0,0,[
  box(ev.has("SUPPLY_DOC"),"Documento de suministro / entrega"),
  box(ev.has("STORAGE_TEMP"),"Registro de temperatura de almacenamiento"),
  box(ev.has("RETURN_TEMP"),"Registro de temperatura de transporte de retorno"),
  box(ev.has("NA_TEMP"),"N/A · sin requisitos especiales de temperatura"),
  box(ev.has("OTHER"),`Otra documentación: ${text(r.customerEvidenceOther)}`),
  text(r.customerDeclarationObservations),
 ].filter(Boolean).join("\n"));
 xml=setWordCellTextBalanced(xml,4,0,1,[text(r.customerDeclarationSigner),text(r.customerDeclarationSignerRole),date(r.customerDeclarationDate)].filter(Boolean).join(" · "));
 xml=setWordCellTextBalanced(xml,5,0,1,text(r.qaApprovalName));xml=setWordCellTextBalanced(xml,5,1,1,text(r.technicalApprovalName));
 updateZipEntry(entries,"word/document.xml",xml);sanitizeOfficeMetadata(entries);return writeZip(entries);
}

