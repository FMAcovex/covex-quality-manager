"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { preserveFormState } from "@/lib/forms/preserved-state";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { auditFormInput } from "./validation";
import { saveAudit, AuditValidationError } from "./service";
import { OperationalBusinessCodeError } from "@/lib/qms/business-code";

export type AuditFormState = { error: string | null; fieldErrors?: Record<string, string>; submittedValues?: Record<string, string | string[]>; formRevision?: number };
export async function saveAuditAction(id: string | null, previous: AuditFormState, fd: FormData): Promise<AuditFormState> {
  let saved;
  try { saved = await saveAudit(auditFormInput(fd), id ?? undefined); }
  catch (error) {
    if (error instanceof AuditValidationError) return preserveFormState(previous, fd, { error: "Revisa los campos indicados.", fieldErrors: error.fields });
    if (error instanceof OperationalBusinessCodeError) return preserveFormState(previous, fd, { error: error.message, fieldErrors: { businessCode: error.message } });
    return preserveFormState(previous, fd, { error: persistenceFormError(error, "la auditoría").error });
  }
  revalidatePath("/audits"); revalidatePath(`/audits/${saved.id}`); revalidatePath(`/qms/${saved.qmsRecordId}`);
  redirect(`/audits/${saved.id}`);
}
