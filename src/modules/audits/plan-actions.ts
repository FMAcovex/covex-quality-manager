"use server";
import { redirect } from "next/navigation";
import { addPlanEntry, createAnnualPlan, retirePlanEntry, updatePlanEntry } from "./plans";
const programmeFields=(fd:FormData)=>Object.fromEntries(["plannedPeriodText","plannedAuditorsText","productService","plannedScope","plannedModality","programmeArea"].map(k=>[k,String(fd.get(k)??"").trim()]));
const str=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();
export async function createPlanAction(fd:FormData) {
  let id:string;
  try{const plan=await createAnnualPlan({year:str(fd,"year"),auditType:str(fd,"auditType"),title:str(fd,"title"),notes:str(fd,"notes"),actor:str(fd,"actor")});id=plan.id;}
  catch(e){throw new Error(e instanceof Error?e.message:"No se pudo crear el plan.");}
  redirect("/audits/plans/"+id);
}
export async function addPlanEntryAction(planId:string,fd:FormData){
  await addPlanEntry(planId,{...programmeFields(fd),subject:str(fd,"subject"),targetName:str(fd,"targetName"),departmentId:str(fd,"departmentId"),plannedDate:str(fd,"plannedDate"),notes:str(fd,"notes"),actor:str(fd,"actor"),reason:""});
  redirect("/audits/plans/"+planId);
}
export async function updatePlanEntryAction(planId:string,entryId:string,fd:FormData){
  await updatePlanEntry(planId,entryId,{...programmeFields(fd),subject:str(fd,"subject"),targetName:str(fd,"targetName"),departmentId:str(fd,"departmentId"),plannedDate:str(fd,"plannedDate"),notes:str(fd,"notes"),actor:str(fd,"actor"),reason:str(fd,"reason")});
  redirect("/audits/plans/"+planId);
}
export async function retirePlanEntryAction(planId:string,entryId:string,fd:FormData){
  await retirePlanEntry(planId,entryId,str(fd,"actor"),str(fd,"reason"));
  redirect("/audits/plans/"+planId);
}

export type PlanEntryActionState = { error?: string };
const planEntryInput = (fd: FormData, updating: boolean) => ({
  ...programmeFields(fd), subject: str(fd, "subject"), targetName: str(fd, "targetName"),
  departmentId: str(fd, "departmentId"), plannedDate: str(fd, "plannedDate"),
  notes: str(fd, "notes"), actor: str(fd, "actor"), reason: updating ? str(fd, "reason") : "",
});
const errorText = (e: unknown) => {
  if (e && typeof e === "object" && "issues" in e && Array.isArray(e.issues)) {
    return e.issues.map((issue: { message: string }) => issue.message).join(" ");
  }
  return e instanceof Error ? e.message : "No se pudo guardar la planificación.";
};
export async function addPlanEntryFormAction(planId: string, _state: PlanEntryActionState, fd: FormData): Promise<PlanEntryActionState> {
  try { await addPlanEntry(planId, planEntryInput(fd, false)); }
  catch (e) { return { error: errorText(e) }; }
  redirect("/audits/plans/" + planId);
}
export async function updatePlanEntryFormAction(planId: string, entryId: string, _state: PlanEntryActionState, fd: FormData): Promise<PlanEntryActionState> {
  try { await updatePlanEntry(planId, entryId, planEntryInput(fd, true)); }
  catch (e) { return { error: errorText(e) }; }
  redirect("/audits/plans/" + planId);
}
