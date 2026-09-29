export type DeviationSaveMode = "UPDATE_CURRENT" | "CREATE_VERSION";

export function deviationSaveMode(value: FormDataEntryValue | null): DeviationSaveMode {
  return value === "new-version" ? "CREATE_VERSION" : "UPDATE_CURRENT";
}

export function deviationVersionKind({
  saveMode,
  reopening,
}: {
  saveMode: DeviationSaveMode;
  reopening: boolean;
}): "FOLLOWUP" | "REOPENING" | null {
  if (saveMode !== "CREATE_VERSION") return null;
  return reopening ? "REOPENING" : "FOLLOWUP";
}

export function deviationVersionLabel(sequenceNumber: number) {
  return `V${String(sequenceNumber).padStart(2, "0")}`;
}
