import type { ReturnProductInput } from "./types";

// GC-00/028/03 §§5.3–5.6. Acceptance means managing the return, not release.
export const returnDestinations = {
 SELLABLE_STOCK:"Reincorporación a stock vendible",
 CONFORMING_STOCK:"Reincorporación a stock conforme/utilizable",
 REANALYSIS:"Reanálisis", REPROCESS:"Reprocesado", REWORK:"Retrabajo",
 REJECT:"Rechazo", DESTROY:"Destrucción", RETURN_CUSTOMER:"Devolución al cliente",
 BLOCKED:"Bloqueo / cuarentena", OTHER:"Otro circuito autorizado",
} as const;
export type ReturnContext = {
 destinationKind?:keyof typeof returnDestinations;
 medicineFromWholesale:boolean;ambientPeriodRiskJustification?:string;
 temperatureControlled:boolean; serializedMedicine:boolean;
 declarationRequired:boolean; qcRequired:boolean; requiresFollowup:boolean;
};
export function returnContext(value:unknown):ReturnContext{
 const raw=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const destinationKind=typeof raw.destinationKind==="string"&&raw.destinationKind in returnDestinations?raw.destinationKind as keyof typeof returnDestinations:undefined;
 return {destinationKind,medicineFromWholesale:raw.medicineFromWholesale===true,ambientPeriodRiskJustification:typeof raw.ambientPeriodRiskJustification==="string"?raw.ambientPeriodRiskJustification.trim():undefined,temperatureControlled:raw.temperatureControlled===true,serializedMedicine:raw.serializedMedicine===true,declarationRequired:raw.declarationRequired===true,qcRequired:raw.qcRequired===true,requiresFollowup:raw.requiresFollowup===true};
}
export function contextFromExtraData(value:unknown){
 return returnContext(value&&typeof value==="object"&&!Array.isArray(value)?(value as Record<string,unknown>).r4b:null);
}
export function reintegrationRequested(destination:string|null,context:ReturnContext){
 const text=(destination??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return context.destinationKind==="SELLABLE_STOCK"||context.destinationKind==="CONFORMING_STOCK"||/reintegr|reincorpor|stock (vendible|conforme|utilizable)/.test(text);
}
export function returnApplicability(products:Pick<ReturnProductInput,"productType">[],conditions:string|null,context:ReturnContext){
 const medicine=products.some(p=>p.productType==="MEDICINE");
 const api=products.some(p=>p.productType==="API"||p.productType==="INTERMEDIATE");
 // An explicit cold condition cannot be bypassed by unticking the checkbox.
 const cold=context.temperatureControlled||/termol[aá]bil|cadena de fr[ií]o|[+]?[2]\s*[º°]?\s*(?:c\s*)?[/–-]\s*[+]?[8]/i.test(conditions??"");
 return {medicine,api,cold,serialized:medicine&&context.serializedMedicine};
}
export const generalReturnChecks=["withinAcceptedReturnPeriod","packagingIntegrityOk","storageTransportConditionsOk","noUseDamageContamination","noRecallAlertBlock","expiryAcceptable"] as const;
export const coldReturnChecks=["storageTemperatureRecord","returnTransportTempEvidence","transportPackagingSuitable","receiptTemperatureAcceptable","temperatureExcursionEvaluated","coldChainReturnSystemValidated"] as const;
/** Etiquetas de las comprobaciones tal como salen en el formulario (D-117: los mensajes no muestran nombres internos). */
export const returnCheckLabels:Record<string,string>={withinAcceptedReturnPeriod:"Plazo aceptable de devolución",roomTemperatureWithinTenDays:"+15/+25 ºC dentro de 10 días",coldChainWithinFortyEightHours:"+2/+8 ºC dentro de 48 h",uniqueIdentifierActive:"Identificador único / Data Matrix activo",tamperEvidenceIntact:"Tamper Evidence intacto",packagingIntegrityOk:"Envases íntegros",customerDeclarationAvailable:"Declaración cliente disponible",storageTransportConditionsOk:"Almacenamiento/transporte conforme",noUseDamageContamination:"Sin uso/daño/contaminación",noRecallAlertBlock:"Sin retirada/alerta/bloqueo",expiryAcceptable:"Caducidad/reanálisis aceptable",qcAssessmentCompleted:"Evaluación Control de Calidad",storageTemperatureRecord:"Registro temperatura almacenamiento",returnTransportTempEvidence:"Evidencia temperatura transporte retorno",transportPackagingSuitable:"Embalaje de transporte conforme",receiptTemperatureAcceptable:"Temperatura recepción aceptable",temperatureExcursionEvaluated:"Excursión evaluada/documentada",coldChainReturnSystemValidated:"Sistema devolución termolábiles validado"};
export function validReturnDate(value:string|null){
 return !value||(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value);
}
