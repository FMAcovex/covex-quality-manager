"use server";
import { authorizedAction } from "@/lib/auth/action-guard";
import { preserveFormState } from "@/lib/forms/preserved-state";
import { persistenceFormError } from "@/lib/forms/persistence-error";
import { auditFormInput } from "./validation";
import { saveAudit, AuditValidationError } from "./service";
import { OperationalBusinessCodeError } from "@/lib/qms/business-code";

export type AuditFormState = { error: string | null; fieldErrors?: Record<string, string>; submittedValues?: Record<string, string | string[]>; formRevision?: number; savedHref?: string };
async function saveAuditActionAuthenticatedContent(id: string | null, previous: AuditFormState, fd: FormData): Promise<AuditFormState> {
  let saved;
  try { saved = await saveAudit(auditFormInput(fd), id ?? undefined); }
  catch (error) {
    if (error instanceof AuditValidationError) return preserveFormState(previous, fd, { error: "Revisa los campos indicados.", fieldErrors: error.fields });
    if (error instanceof OperationalBusinessCodeError) return preserveFormState(previous, fd, { error: error.message, fieldErrors: { businessCode: error.message } });
    return preserveFormState(previous, fd, { error: persistenceFormError(error, "la auditoría").error });
  }
  // Dynamic routes read fresh data after the client receives this completed action.
  // Avoid coupling its result to a concurrent RSC invalidation/redirect transition.
  return { error: null, savedHref: `/audits/${saved.id}` };
}

export async function saveAuditAction(...args: Parameters<typeof saveAuditActionAuthenticatedContent>) {
  return authorizedAction("saveAuditAction", args, authenticated => saveAuditActionAuthenticatedContent(...authenticated as Parameters<typeof saveAuditActionAuthenticatedContent>));
}
