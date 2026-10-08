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

export function complaintNewVersionErrors(date:string,reason:string){
 const errors:string[]=[];
 if(!reason.trim())errors.push("Debe indicarse el motivo del seguimiento o de la nueva versión.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)errors.push("Debe indicarse una fecha válida del seguimiento o de la nueva versión.");
 return errors;
}
