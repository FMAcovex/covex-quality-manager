import type { Prisma } from "@prisma/client";
import type { ReturnProductInput } from "./types";

export async function saveReturnProducts(tx:Prisma.TransactionClient,returnRecordId:string,products:ReturnProductInput[]){
 const existing=await tx.returnProduct.findMany({where:{returnRecordId}});
 const owned=new Set(existing.map(row=>row.id));
 const ids=products.flatMap(p=>p.id?[p.id]:[]);
 if(new Set(ids).size!==ids.length||ids.some(id=>!owned.has(id)))throw new Error("Un producto no pertenece a esta devolución o está repetido.");
 const removed=existing.filter(p=>!ids.includes(p.id));
 await tx.returnProduct.deleteMany({where:{returnRecordId,id:{in:removed.map(p=>p.id)}}});
 for(let i=0;i<products.length;i++){
  const p=products[i];
  if(p.departmentId){const department=await tx.department.findUnique({where:{id:p.departmentId},select:{code:true}});if(!department||!/^LG-(00|10|20|30|40)$/.test(department.code))throw new Error("El área del producto no es válida.");}
  const date=(v:string)=>v?new Date(v):null;
  const data={departmentId:p.departmentId||null,productType:p.productType,otherProductType:p.otherProductType||null,productNameCode:p.productNameCode,format:p.format||null,lot:p.lot||null,expiryReanalysis:p.expiryReanalysis||null,quantity:p.quantity||null,unit:p.unit||null,netWeight:p.netWeight||null,grossWeight:p.grossWeight||null,receptionObservations:p.receptionObservations||null,receivedBy:p.receivedBy||null,receivedByDate:date(p.receivedByDate),verifiedBy:p.verifiedBy||null,verifiedByDate:date(p.verifiedByDate),sortOrder:i};
  if(p.id)await tx.returnProduct.update({where:{id:p.id},data});
  else await tx.returnProduct.create({data:{returnRecordId,...data}});
 }
 return removed;
}
