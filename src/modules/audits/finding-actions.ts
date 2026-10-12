"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { revalidatePath } from "next/cache";
import { saveAuditFinding, saveAuditFindingAction, saveAuditFollowup, retireAuditElement, linkAuditFinding, retireAuditAttribution, unlinkAuditRecord } from "./finding-service";
import type { RelationActionState } from "@/lib/qms/relation-form-types";
export type AuditRetirementFormState = RelationActionState & { savedHref?: string };
export type AuditChildFormState = { error: string | null; values?: Record<string, string>; revision?: number; savedHref?: string };
function invalidate(auditId: string) {
  for (const path of ["/audits", `/audits/${auditId}`, "/capa", "/deviations"]) revalidatePath(path);
  // The shared resolver and inverse views are dynamic; layouts keep canonical UUID links.
  revalidatePath("/capa/[id]", "page"); revalidatePath("/deviations/[id]", "page");
}
async function saveAuditChildActionAuthenticatedContent(auditId: string, kind: "finding" | "action" | "followup", findingId: string | undefined, entityId: string | undefined, state: AuditChildFormState, form: FormData): Promise<AuditChildFormState> {
  const values = Object.fromEntries([...form.entries()].filter(([,v]) => typeof v === "string")) as Record<string,string>;
  let anchor: string;
  try {
    if (kind === "finding") { const row = await saveAuditFinding(auditId, values, entityId); anchor = `audit-finding-${row.id}`; }
    else if (kind === "action") { if (!findingId) throw new Error("Hallazgo obligatorio."); const row = await saveAuditFindingAction(auditId, findingId, values, entityId); anchor = `audit-action-${row.id}`; }
    else { const row = await saveAuditFollowup(auditId, values, entityId); anchor = `audit-followup-${row.id}`; }
    // Both routes are dynamic; the successful document navigation reads fresh data.
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo guardar.", values, revision: (state.revision ?? 0) + 1 }; }
  return { error: null, savedHref: `/audits/${auditId}?tab=${kind === "followup" ? "followup" : "findings"}#${anchor}` };
}
async function linkAuditFindingActionAuthenticatedContent(auditId: string, findingId: string, _state: RelationActionState, form: FormData): Promise<RelationActionState> {
  try { await linkAuditFinding(auditId, findingId, String(form.get("targetRecordId") ?? ""), String(form.get("actor") ?? "")); invalidate(auditId); return { error: null, success: "Expediente vinculado al hallazgo." }; }
  catch (e) { return { error: e instanceof Error ? e.message : "No se pudo vincular." }; }
}
async function retireAuditChildActionAuthenticatedContent(auditId: string, findingId: string, actionId: string | undefined, _state: AuditRetirementFormState, form: FormData): Promise<AuditRetirementFormState> {
  try { await retireAuditElement(auditId, findingId, { actor: form.get("actor"), reason: form.get("reason") }, actionId); return { error: null, success: "Retirada registrada.", savedHref: `/audits/${auditId}?tab=findings` }; }
  catch (e) { return { error: e instanceof Error ? e.message : "No se pudo retirar." }; }
}
async function retireAuditAttributionActionAuthenticatedContent(auditId: string, findingId: string, attributionId: string, _state: AuditRetirementFormState, form: FormData): Promise<AuditRetirementFormState> {
  try { await retireAuditAttribution(auditId, findingId, attributionId, { actor: form.get("actor"), reason: form.get("reason") }); return { error: null, success: "Atribución retirada; vínculo global conservado.", savedHref: `/audits/${auditId}?tab=findings#audit-finding-${findingId}` }; }
  catch (e) { return { error: e instanceof Error ? e.message : "No se pudo retirar." }; }
}
async function unlinkAuditRecordActionAuthenticatedContent(auditId: string, targetRecordId: string, _state: AuditRetirementFormState, form: FormData): Promise<AuditRetirementFormState> {
  try { await unlinkAuditRecord(auditId, targetRecordId, { actor: form.get("actor"), reason: form.get("reason") }); return { error: null, success: "Expedientes desvinculados.", savedHref: `/audits/${auditId}?tab=relations` }; }
  catch (e) { return { error: e instanceof Error ? e.message : "No se pudo desvincular." }; }
}

export async function saveAuditChildAction(...args: Parameters<typeof saveAuditChildActionAuthenticatedContent>) {
  return authorizedAction("saveAuditChildAction", args, authenticated => saveAuditChildActionAuthenticatedContent(...authenticated as Parameters<typeof saveAuditChildActionAuthenticatedContent>));
}

export async function linkAuditFindingAction(...args: Parameters<typeof linkAuditFindingActionAuthenticatedContent>) {
  return authorizedAction("linkAuditFindingAction", args, authenticated => linkAuditFindingActionAuthenticatedContent(...authenticated as Parameters<typeof linkAuditFindingActionAuthenticatedContent>));
}

export async function retireAuditChildAction(...args: Parameters<typeof retireAuditChildActionAuthenticatedContent>) {
  return authorizedAction("retireAuditChildAction", args, authenticated => retireAuditChildActionAuthenticatedContent(...authenticated as Parameters<typeof retireAuditChildActionAuthenticatedContent>));
}

export async function retireAuditAttributionAction(...args: Parameters<typeof retireAuditAttributionActionAuthenticatedContent>) {
  return authorizedAction("retireAuditAttributionAction", args, authenticated => retireAuditAttributionActionAuthenticatedContent(...authenticated as Parameters<typeof retireAuditAttributionActionAuthenticatedContent>));
}

export async function unlinkAuditRecordAction(...args: Parameters<typeof unlinkAuditRecordActionAuthenticatedContent>) {
  return authorizedAction("unlinkAuditRecordAction", args, authenticated => unlinkAuditRecordActionAuthenticatedContent(...authenticated as Parameters<typeof unlinkAuditRecordActionAuthenticatedContent>));
}
