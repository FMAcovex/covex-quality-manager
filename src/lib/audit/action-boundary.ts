import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../db";
import { currentIdentity, type AccessModule, type AccessPermission } from "../auth/context";
import { auditPolicyState } from "./activation";
import { canonicalAuditJson } from "./canonical-json";
import { withBusinessAuditResult } from "./business-service";
import { requiresAuditReason, persistenceFormError } from "../forms/persistence-error";
import { preserveFormState, type PreservedFormState } from "../forms/preserved-state";

// Trusted action semantics. Field-level SQL events retain the actual persisted
// changes when one save spans several rows in the approved 63-operation matrix.
const operations: Record<string, string> = {
  createDeviationAction: "DV01", updateDeviationAction: "DV02", addDeviationFollowupAction: "DV05", addDeviationRelationAction: "DV08", unlinkDeviationCapaAction: "DV08", uploadDeviationSignedPdfAction: "DV08",
  createCapaAction: "CA01", updateCapaAction: "CA02", addCapaFollowupAction: "CA04", addCapaRelationAction: "CA07", unlinkCapaOriginAction: "CA07", uploadCapaSignedPdfAction: "CA08",
  createChangeControlAction: "CC01", updateChangeControlAction: "CC02", addChangeControlFollowupAction: "CC04", updateChangeControlFollowupAction: "CC04", uploadChangeControlSignedPdfAction: "CC07",
  createComplaintAction: "RC01", updateComplaintAction: "RC02", addComplaintFollowupAction: "RC04", addComplaintRelationAction: "RC06", unlinkComplaintRelationAction: "RC06", uploadComplaintSignedPdfAction: "RC07",
  createReturnAction: "DE01", updateReturnAction: "DE02", addReturnFollowupAction: "DE04", addReturnRelationAction: "DE06", unlinkReturnComplaintAction: "DE06", uploadReturnSignedPdfAction: "DE07",
  saveAuditAction: "AU01", saveAuditChildAction: "AU02", linkAuditFindingAction: "AU05", retireAuditChildAction: "AU03", retireAuditAttributionAction: "AU05", unlinkAuditRecordAction: "AU05",
  createPlanAction: "AU08", addPlanEntryAction: "AU08", updatePlanEntryAction: "AU08", retirePlanEntryAction: "AU08", addPlanEntryFormAction: "AU08", updatePlanEntryFormAction: "AU08", saveProgrammeApproversAction: "AU09", issueAnnualProgrammeAction: "AU09",
  saveAuditReportAction: "AU06", issueAuditReportAction: "AU06", closeAuditAction: "AU07", registerAuditAttachmentAction: "AU06", storeAuditSignedPdfAction: "AU06",
  masterAction: "PN01", revisionAction: "PN01",
  createReviewThreadAction: "TR01", replyToReviewThreadAction: "TR01", acceptReviewThreadAction: "TR01", resolveReviewThreadAction: "TR01", createCurrentVersionReviewThreadAction: "TR01",
  administerUser: "TR05", configureRole: "TR05",
};

export async function actionCommand(name: string, args: unknown[]) {
  const fields: [string, unknown][] = [];
  let requestId = "", reason: string | null = null;
  for (const arg of args) {
    if (arg instanceof FormData) {
      requestId ||= String(arg.get("_covexAuditRequestId") ?? "");
      for (const key of ["changeReason", "replacementReason", "reason", "annulledReason", "cancellationReason"]) reason ||= String(arg.get(key) ?? "").trim() || null;
      for (const [key, value] of arg) {
        if (/^_covex|^(actor|modifiedByText|createdByText)$|password|secret|token|verifier/i.test(key)) continue;
        fields.push([key, typeof value === "string" ? value : { name: value.name, mimeType: value.type, size: value.size, sha256: createHash("sha256").update(new Uint8Array(await value.arrayBuffer())).digest("hex") }]);
      }
    } else if (typeof arg === "string" || arg === null) fields.push(["resource", arg]);
    else if (arg && typeof arg === "object" && ("qmsRecordId" in arg || "reviewThreadId" in arg || "objectId" in arg || "roleId" in arg)) {
      const input = arg as Record<string, unknown>;
      requestId ||= String(input._covexAuditRequestId ?? "");
      reason ||= typeof input.reason === "string" ? input.reason.trim() || null : null;
      fields.push(["input", Object.fromEntries(Object.entries(input).filter(([key]) => !/^_covex|ByText$|^(actor)$|password|secret|token|verifier/i.test(key)))]);
    }
  }
  fields.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return { requestId: requestId || randomUUID(), reason, digest: createHash("sha256").update(canonicalAuditJson({ name, fields })).digest("hex") };
}

export async function actionAuditBoundary<T>(name: string, args: unknown[], module: AccessModule, permission: AccessPermission, execute: () => Promise<T>): Promise<T> {
  const context = currentIdentity();
  if (context?.unitTest && process.env.VITEST === "true" && process.env.APP_ENV === "test") return execute();
  const operationCode = name === "saveAuditChildAction" ? args[1] === "followup" ? "AU04" : args[1] === "action" ? "AU03" : "AU02" : operations[name];
  if (!operationCode) return execute(); // Configuration has its own existing envelope.
  const state = await auditPolicyState(prisma);
  if (!state.required) return execute();
  const review = operationCode === "TR01";
  let result: T;
  try { result = await withBusinessAuditResult({ operationCode, module, permission }, await actionCommand(name, args), async () => {
    const response = await execute();
    if (review && response && typeof response === "object" && "threads" in response) {
      // This is the mutable display query, not the committed command response.
      // Store only the thread ID/status and reload the ordinary view after commit.
      const { threads: _threads, ...receipt } = response;
      void _threads;
      return receipt as T;
    }
    return response;
  }); } catch (error) {
    const form = args.find(arg=>arg instanceof FormData) as FormData|undefined;
    if (!form || !requiresAuditReason(error)) throw error;
    const previous = args.find(arg=>arg && typeof arg==="object" && !(arg instanceof FormData) && !Array.isArray(arg)) as PreservedFormState|undefined;
    const state = persistenceFormError(error,"la operación");
    return preserveFormState(previous??{},form,module==="AUDIT"?{error:state.error,fieldErrors:{changeReason:state.error}}:state) as T;
  }
  if (review && result && typeof result === "object" && "success" in result && result.success && context?.resource?.id) {
    const { getReviewThreadsForDisplay } = await import("../qms/review/ui-queries");
    return { ...result, threads: await getReviewThreadsForDisplay(context.resource.id) } as T;
  }
  return result;
}
