export function formatDate(value:Date|string|null|undefined){if(!value)return "—";const d=value instanceof Date?value:new Date(value);return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);}
export function returnTypeLabel(v:string){return ({COMMERCIAL:"Comercial",COMPLAINT:"Reclamación",RECALL:"Retirada",EXPIRY:"Caducidad",TRANSPORT:"Transporte",OTHER:"Otra"} as Record<string,string>)[v]??v;}
export function returnDecisionLabel(v:string){return v==="ACCEPTED"?"Aceptada":v==="REJECTED"?"Rechazada":"Pendiente";}
export function returnStatusLabel(v:string){return v==="CLOSED"?"Cerrada":"Abierta";}
export function productTypeLabel(v:string){return ({API:"API",INTERMEDIATE:"Intermedio",MEDICINE:"Medicamento",SUPPLEMENT:"Complemento alimenticio",IMPORTED_PRODUCT:"Producto importado",MEDICAL_DEVICE:"Producto sanitario",COSMETIC:"Cosmético",OTHER:"Otro"} as Record<string,string>)[v]??v;}
export function tri(v:string|null|undefined){return v==="YES"?"Sí":v==="NO"?"No":v==="NA"?"N/A":"—";}
