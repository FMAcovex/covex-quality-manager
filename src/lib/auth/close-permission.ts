import type { AccessModule, AccessPermission } from "./context";

/**
 * Acciones de edición de un expediente cuyo estado puede ser «Cerrado»: módulo, modelo y campo del estado
 * guardado, y campos del formulario con el estado de destino (el primero que llegue prevalece).
 */
const RECORD_STATUS_ACTIONS: Record<string, { module: AccessModule; model: string; field: string; formFields: string[] }> = {
  updateDeviationAction: { module: "DEVIATION", model: "deviation", field: "status", formFields: ["status"] },
  updateCapaAction: { module: "CAPA", model: "capa", field: "status", formFields: ["status"] },
  updateChangeControlAction: { module: "CHANGE_CONTROL", model: "changeControl", field: "finalStatus", formFields: ["finalStatus"] },
  // Reclamaciones envía el estado de destino en `saveStatus` (prevalece sobre `status`).
  updateComplaintAction: { module: "COMPLAINT", model: "complaint", field: "status", formFields: ["saveStatus", "status"] },
  updateOosAction: { module: "OOS", model: "oosRecord", field: "status", formFields: ["status"] },
  updateReturnAction: { module: "RETURN", model: "returnRecord", field: "status", formFields: ["status"] },
};

export function recordStatusSource(action: string) {
  return RECORD_STATUS_ACTIONS[action];
}

/** Estado de destino que envía el formulario de la acción; null si no envía ninguno; undefined si la acción no es de las de expediente. */
export function recordStatusTarget(action: string, form: FormData | undefined): string | null | undefined {
  const source = RECORD_STATUS_ACTIONS[action];
  if (!source) return undefined;
  for (const field of source.formFields) {
    const value = form?.get(field);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Permisos que exige guardar un expediente según su estado guardado y el de destino, igual que la página de
 * edición (4B1, `page-guard.ts`): editar un expediente cerrado exige CLOSE (lo reabra o no) y uno cancelado,
 * ANNUL; cerrarlo exige CLOSE. Así un envío directo a la acción no puede hacer lo que la página no permite.
 */
export function recordStatusPermissions(target: string | null, current: string | null): AccessPermission[] {
  const permissions: AccessPermission[] = [];
  if (current === "CLOSED" || target === "CLOSED") permissions.push("CLOSE");
  if (current === "CANCELLED") permissions.push("ANNUL");
  return permissions;
}
