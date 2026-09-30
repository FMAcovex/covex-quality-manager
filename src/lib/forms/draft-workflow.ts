export type DraftCapableStatus = "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";

export function requestedWorkflowStatus<T extends DraftCapableStatus>(
  formData: FormData,
  fallback: T,
): T | "DRAFT" | "OPEN" {
  const intent = String(formData.get("saveIntent") ?? "").trim();
  if (intent === "draft") return "DRAFT";
  if (intent === "open") return "OPEN";
  return fallback;
}

export function isDraftSave(status: string) {
  return status === "DRAFT";
}

export function canReturnToDraft(existingStatus: string) {
  return existingStatus === "DRAFT";
}
