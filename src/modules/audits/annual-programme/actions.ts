"use server";
import { revalidatePath } from "next/cache";
import { issueAnnualProgramme, saveProgrammeApprovers } from "./service";
import { ZodError } from "zod";
export type ProgrammeActionState = { error?: string; success?: string };
const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const message = (e: unknown) => e instanceof ZodError ? e.issues.map(i => i.message).join(" ") : e instanceof Error ? e.message : "No se pudo completar la operación.";
export async function saveProgrammeApproversAction(planId: string, _state: ProgrammeActionState, fd: FormData): Promise<ProgrammeActionState> {
  try {
    await saveProgrammeApprovers(planId, Object.fromEntries(["technicalApproverName", "qualityApproverName", "actor", "reason"].map(k => [k, value(fd, k)])));
    revalidatePath(`/audits/plans/${planId}`);
    return { success: "Datos de aprobación guardados. La firma y la fecha se cumplimentan en Word." };
  } catch (e) { return { error: message(e) }; }
}
export async function issueAnnualProgrammeAction(planId: string, _state: ProgrammeActionState, fd: FormData): Promise<ProgrammeActionState> {
  try {
    const version = await issueAnnualProgramme(planId, Object.fromEntries(["actor", "reason", "requestId", "expectedFingerprint"].map(k => [k, value(fd, k)])));
    revalidatePath(`/audits/plans/${planId}`);
    return { success: `Emisión ${String(version.sequenceNumber).padStart(2, "0")} conservada. Descárgala desde el histórico.` };
  } catch (e) { return { error: message(e) }; }
}
