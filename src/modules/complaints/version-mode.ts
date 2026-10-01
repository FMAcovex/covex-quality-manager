export type ComplaintSaveMode = "UPDATE_CURRENT" | "CREATE_VERSION";

export function complaintSaveMode(value: FormDataEntryValue | null): ComplaintSaveMode {
  return value === "new-version" ? "CREATE_VERSION" : "UPDATE_CURRENT";
}

export function complaintVersionKind({
  saveMode,
  reopening,
}: {
  saveMode: ComplaintSaveMode;
  reopening: boolean;
}): "FOLLOWUP" | "REOPENING" | null {
  if (saveMode !== "CREATE_VERSION") return null;
  return reopening ? "REOPENING" : "FOLLOWUP";
}
