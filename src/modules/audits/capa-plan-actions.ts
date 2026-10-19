"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { establishCapaPlan, recordCapaPlanFollowup } from "./capa-plan-service";
import type { AuditReportActionState } from "./report-actions";

const values = (fd: FormData) => Object.fromEntries([...fd.entries()].filter((entry): entry is [string,string] => typeof entry[1] === "string"));
async function establishCapaPlanActionAuthenticatedContent(id: string, previous: AuditReportActionState, fd: FormData): Promise<AuditReportActionState> {
  try { await establishCapaPlan(id, values(fd)); return { error: null, savedHref: `/audits/${id}?tab=followup` }; }
  catch (error) { return { error: error instanceof Error ? error.message : "No se pudo establecer el CAPA plan.", values: values(fd), revision: (previous.revision ?? 0) + 1 }; }
}
async function recordCapaPlanFollowupActionAuthenticatedContent(id: string, previous: AuditReportActionState, fd: FormData): Promise<AuditReportActionState> {
  try { await recordCapaPlanFollowup(id, values(fd)); return { error: null, savedHref: `/audits/${id}?tab=followup` }; }
  catch (error) { return { error: error instanceof Error ? error.message : "No se pudo registrar el seguimiento.", values: values(fd), revision: (previous.revision ?? 0) + 1 }; }
}

export async function establishCapaPlanAction(...args: Parameters<typeof establishCapaPlanActionAuthenticatedContent>) {
  return authorizedAction("establishCapaPlanAction", args, authenticated => establishCapaPlanActionAuthenticatedContent(...authenticated as Parameters<typeof establishCapaPlanActionAuthenticatedContent>));
}

export async function recordCapaPlanFollowupAction(...args: Parameters<typeof recordCapaPlanFollowupActionAuthenticatedContent>) {
  return authorizedAction("recordCapaPlanFollowupAction", args, authenticated => recordCapaPlanFollowupActionAuthenticatedContent(...authenticated as Parameters<typeof recordCapaPlanFollowupActionAuthenticatedContent>));
}
