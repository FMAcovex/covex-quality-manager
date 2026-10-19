"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { revalidatePath } from "next/cache";
import { issueAnnualProgramme, saveProgrammeApprovers } from "./service";
import { ZodError } from "zod";
import { preserveFormState, type PreservedFormState } from "@/lib/forms/preserved-state";
export type ProgrammeActionState = { error?: string; success?: string } & PreservedFormState;
const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const message = (e: unknown) => e instanceof ZodError ? e.issues.map(i => i.message).join(" ") : e instanceof Error ? e.message : "No se pudo completar la operación.";
async function saveProgrammeApproversActionAuthenticatedContent(planId: string, state: ProgrammeActionState, fd: FormData): Promise<ProgrammeActionState> {
  try {
    await saveProgrammeApprovers(planId, Object.fromEntries(["technicalApproverName", "qualityApproverName", "actor", "reason"].map(k => [k, value(fd, k)])));
    revalidatePath(`/audits/plans/${planId}`);
    return { success: "Datos de aprobación guardados. La firma y la fecha se cumplimentan en Word." };
  } catch (e) { return preserveFormState(state, fd, { error: message(e) }); }
}
async function issueAnnualProgrammeActionAuthenticatedContent(planId: string, state: ProgrammeActionState, fd: FormData): Promise<ProgrammeActionState> {
  try {
    const version = await issueAnnualProgramme(planId, Object.fromEntries(["actor", "reason", "requestId", "expectedFingerprint"].map(k => [k, value(fd, k)])));
    revalidatePath(`/audits/plans/${planId}`);
    return { success: `Emisión ${String(version.sequenceNumber).padStart(2, "0")} conservada. Descárgala desde el histórico.` };
  } catch (e) { return preserveFormState(state, fd, { error: message(e) }); }
}

export async function saveProgrammeApproversAction(...args: Parameters<typeof saveProgrammeApproversActionAuthenticatedContent>) {
  return authorizedAction("saveProgrammeApproversAction", args, authenticated => saveProgrammeApproversActionAuthenticatedContent(...authenticated as Parameters<typeof saveProgrammeApproversActionAuthenticatedContent>));
}

export async function issueAnnualProgrammeAction(...args: Parameters<typeof issueAnnualProgrammeActionAuthenticatedContent>) {
  return authorizedAction("issueAnnualProgrammeAction", args, authenticated => issueAnnualProgrammeActionAuthenticatedContent(...authenticated as Parameters<typeof issueAnnualProgrammeActionAuthenticatedContent>));
}
