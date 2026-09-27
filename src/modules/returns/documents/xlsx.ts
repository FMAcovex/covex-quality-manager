import { generateSimpleXlsx } from "@/lib/ooxml/simple-xlsx";
import { formatDate,returnDecisionLabel,returnStatusLabel,returnTypeLabel } from "@/modules/returns/domain";
type Row=Awaited<ReturnType<typeof import("@/modules/returns/documents/export-data").getReturnExportRows>>[number];
export function generateReturnSimpleList(rows:Row[]){
 const headers=["N.º devolución","Fecha comunicación","Fecha recepción","Tipo","Cliente/Entidad","País","Documento relacionado","Producto","Formato","Lote","Cantidad","Caducidad/Reanálisis","Decisión","Destino final","Destrucción","Certificado destrucción","Estado","Último seguimiento","Próximo seguimiento"];
 const out=rows.flatMap(r=>r.products.length?r.products.map((p,i)=>{const f=r.followups[0];return[
  r.qmsRecord.businessCode??"",formatDate(r.communicationDate),formatDate(r.receivedAt),returnTypeLabel(r.returnType),r.customerEntity??"",r.country??"",r.relatedDocument??"",
  p.productNameCode,p.format??"",p.lot??"",[p.quantity,p.unit].filter(Boolean).join(" "),p.expiryReanalysis??"",returnDecisionLabel(r.decision),r.finalDestination??"",
  r.destructionManagedBy??"",r.destructionCertificate??"",returnStatusLabel(r.status),i===0&&f?formatDate(f.followupDate):"",i===0&&f?formatDate(f.nextFollowupDate):""
 ]}):[[
  r.qmsRecord.businessCode??"",formatDate(r.communicationDate),formatDate(r.receivedAt),returnTypeLabel(r.returnType),r.customerEntity??"",r.country??"",r.relatedDocument??"",
  "","","","","",returnDecisionLabel(r.decision),r.finalDestination??"",r.destructionManagedBy??"",r.destructionCertificate??"",returnStatusLabel(r.status),"",""
 ]]);
 return generateSimpleXlsx("Devoluciones",headers,out);
}
