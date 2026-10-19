"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { redirect } from "next/navigation";
import { addPlanEntry, createAnnualPlan, retirePlanEntry, updatePlanEntry } from "./plans";
import { preserveFormState, type PreservedFormState } from "@/lib/forms/preserved-state";
const programmeFields=(fd:FormData)=>Object.fromEntries(["plannedPeriodText","plannedAuditorsText","productService","plannedScope","plannedModality","programmeArea"].map(k=>[k,String(fd.get(k)??"").trim()]));
const str=(fd:FormData,key:string)=>String(fd.get(key)??"").trim();
async function createPlanActionAuthenticatedContent(fd:FormData) {
  let id:string;
  try{const plan=await createAnnualPlan({year:str(fd,"year"),auditType:str(fd,"auditType"),title:str(fd,"title"),notes:str(fd,"notes"),actor:str(fd,"actor")});id=plan.id;}
  catch(e){throw new Error(e instanceof Error?e.message:"No se pudo crear el plan.");}
  redirect("/audits/plans/"+id);
}
async function addPlanEntryActionAuthenticatedContent(planId:string,fd:FormData){
  await addPlanEntry(planId,{...programmeFields(fd),subject:str(fd,"subject"),targetName:str(fd,"targetName"),departmentId:str(fd,"departmentId"),plannedDate:str(fd,"plannedDate"),notes:str(fd,"notes"),actor:str(fd,"actor"),reason:""});
  redirect("/audits/plans/"+planId);
}
async function updatePlanEntryActionAuthenticatedContent(planId:string,entryId:string,fd:FormData){
  await updatePlanEntry(planId,entryId,{...programmeFields(fd),subject:str(fd,"subject"),targetName:str(fd,"targetName"),departmentId:str(fd,"departmentId"),plannedDate:str(fd,"plannedDate"),notes:str(fd,"notes"),actor:str(fd,"actor"),reason:str(fd,"reason")});
  redirect("/audits/plans/"+planId);
}
async function retirePlanEntryActionAuthenticatedContent(planId:string,entryId:string,fd:FormData){
  await retirePlanEntry(planId,entryId,str(fd,"actor"),str(fd,"reason"));
  redirect("/audits/plans/"+planId);
}

// R5A: los formularios devuelven lo enviado para no perderlo ante un error (preserveFormState).
export type PlanFormState = { error?: string; success?: string } & PreservedFormState;
export type PlanEntryActionState = PlanFormState;
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
async function addPlanEntryFormActionAuthenticatedContent(planId: string, _state: PlanFormState, fd: FormData): Promise<PlanFormState> {
  try { await addPlanEntry(planId, planEntryInput(fd, false)); }
  catch (e) { return preserveFormState(_state, fd, { error: errorText(e) }); }
  redirect("/audits/plans/" + planId);
}
async function updatePlanEntryFormActionAuthenticatedContent(planId: string, entryId: string, _state: PlanFormState, fd: FormData): Promise<PlanFormState> {
  try { await updatePlanEntry(planId, entryId, planEntryInput(fd, true)); }
  catch (e) { return preserveFormState(_state, fd, { error: errorText(e) }); }
  redirect("/audits/plans/" + planId);
}
async function createPlanFormActionAuthenticatedContent(_state: PlanFormState, fd: FormData): Promise<PlanFormState> {
  let id: string;
  try { id = (await createAnnualPlan({ year: str(fd, "year"), auditType: str(fd, "auditType"), title: str(fd, "title"), notes: str(fd, "notes"), actor: str(fd, "actor") })).id; }
  catch (e) { return preserveFormState(_state, fd, { error: errorText(e) }); }
  redirect("/audits/plans/" + id);
}
async function retirePlanEntryFormActionAuthenticatedContent(planId: string, entryId: string, _state: PlanFormState, fd: FormData): Promise<PlanFormState> {
  try { await retirePlanEntry(planId, entryId, str(fd, "actor"), str(fd, "reason")); }
  catch (e) { return preserveFormState(_state, fd, { error: errorText(e) }); }
  redirect("/audits/plans/" + planId);
}

export async function createPlanAction(...args: Parameters<typeof createPlanActionAuthenticatedContent>) {
  return authorizedAction("createPlanAction", args, authenticated => createPlanActionAuthenticatedContent(...authenticated as Parameters<typeof createPlanActionAuthenticatedContent>));
}

export async function addPlanEntryAction(...args: Parameters<typeof addPlanEntryActionAuthenticatedContent>) {
  return authorizedAction("addPlanEntryAction", args, authenticated => addPlanEntryActionAuthenticatedContent(...authenticated as Parameters<typeof addPlanEntryActionAuthenticatedContent>));
}

export async function updatePlanEntryAction(...args: Parameters<typeof updatePlanEntryActionAuthenticatedContent>) {
  return authorizedAction("updatePlanEntryAction", args, authenticated => updatePlanEntryActionAuthenticatedContent(...authenticated as Parameters<typeof updatePlanEntryActionAuthenticatedContent>));
}

export async function retirePlanEntryAction(...args: Parameters<typeof retirePlanEntryActionAuthenticatedContent>) {
  return authorizedAction("retirePlanEntryAction", args, authenticated => retirePlanEntryActionAuthenticatedContent(...authenticated as Parameters<typeof retirePlanEntryActionAuthenticatedContent>));
}

export async function addPlanEntryFormAction(...args: Parameters<typeof addPlanEntryFormActionAuthenticatedContent>) {
  return authorizedAction("addPlanEntryFormAction", args, authenticated => addPlanEntryFormActionAuthenticatedContent(...authenticated as Parameters<typeof addPlanEntryFormActionAuthenticatedContent>));
}

export async function updatePlanEntryFormAction(...args: Parameters<typeof updatePlanEntryFormActionAuthenticatedContent>) {
  return authorizedAction("updatePlanEntryFormAction", args, authenticated => updatePlanEntryFormActionAuthenticatedContent(...authenticated as Parameters<typeof updatePlanEntryFormActionAuthenticatedContent>));
}

export async function createPlanFormAction(...args: Parameters<typeof createPlanFormActionAuthenticatedContent>) {
  return authorizedAction("createPlanFormAction", args, authenticated => createPlanFormActionAuthenticatedContent(...authenticated as Parameters<typeof createPlanFormActionAuthenticatedContent>));
}

export async function retirePlanEntryFormAction(...args: Parameters<typeof retirePlanEntryFormActionAuthenticatedContent>) {
  return authorizedAction("retirePlanEntryFormAction", args, authenticated => retirePlanEntryFormActionAuthenticatedContent(...authenticated as Parameters<typeof retirePlanEntryFormActionAuthenticatedContent>));
}
