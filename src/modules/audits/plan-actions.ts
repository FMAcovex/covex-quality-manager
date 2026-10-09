"use server";
import { redirect } from "next/navigation";
import { addPlanEntry, createAnnualPlan, retirePlanEntry, updatePlanEntry } from "./plans";
const str=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();
export async function createPlanAction(fd:FormData) {
  let id:string;
  try{const plan=await createAnnualPlan({year:str(fd,"year"),auditType:str(fd,"auditType"),title:str(fd,"title"),notes:str(fd,"notes"),actor:str(fd,"actor")});id=plan.id;}
  catch(e){throw new Error(e instanceof Error?e.message:"No se pudo crear el plan.");}
  redirect("/audits/plans/"+id);
}
export async function addPlanEntryAction(planId:string,fd:FormData){
  await addPlanEntry(planId,{subject:str(fd,"subject"),targetName:str(fd,"targetName"),departmentId:str(fd,"departmentId"),plannedDate:str(fd,"plannedDate"),notes:str(fd,"notes"),actor:str(fd,"actor"),reason:""});
  redirect("/audits/plans/"+planId);
}
export async function updatePlanEntryAction(planId:string,entryId:string,fd:FormData){
  await updatePlanEntry(planId,entryId,{subject:str(fd,"subject"),targetName:str(fd,"targetName"),departmentId:str(fd,"departmentId"),plannedDate:str(fd,"plannedDate"),notes:str(fd,"notes"),actor:str(fd,"actor"),reason:str(fd,"reason")});
  redirect("/audits/plans/"+planId);
}
export async function retirePlanEntryAction(planId:string,entryId:string,fd:FormData){
  await retirePlanEntry(planId,entryId,str(fd,"actor"),str(fd,"reason"));
  redirect("/audits/plans/"+planId);
}
