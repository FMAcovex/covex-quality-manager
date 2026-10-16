import type { AccessModule, AccessPermission, Grant } from "./context";
import { permissionsForModule, qmsModules } from "@/modules/registry";

/** Nombres visibles de los permisos en el editor de roles. */
export const permissionLabels: Record<AccessPermission, string> = {
  READ: "Consultar",
  CREATE: "Crear",
  EDIT: "Editar",
  FOLLOWUP: "Seguimiento",
  REVIEW: "Revisión",
  CLOSE: "Cerrar",
  ANNUL: "Anular",
  DOWNLOAD: "Descargar",
  EXPORT: "Exportar",
  IMPORT: "Importar",
  MANAGE_CONFIGURATION: "Configuración",
  MANAGE_USERS: "Usuarios y roles",
  ATTACH_DOCUMENT: "Adjuntar documentos",
  GENERATE_DOCUMENT: "Generar documentos",
  AUDIT_ISSUE_REPORT: "Emitir informe",
  AUDIT_ISSUE_PROGRAMME: "Emitir programa",
  PNT_VERIFY: "Verificar",
  PNT_RECORD_APPROVAL: "Registrar funciones externas",
  PNT_ACCEPT_APPROVAL: "Aceptar funciones externas",
  PNT_ACTIVATE: "Activar",
  PNT_RETIRE: "Retirar",
  PNT_CORRECT: "Rectificar",
  PNT_LEGACY_REGISTER: "Registro histórico",
  PNT_MANAGE_STATE: "Cambio manual de estado",
  AUDIT_TRAIL_REVIEW: "Revisar audit trail",
  AUDIT_TRAIL_EXPORT: "Exportar audit trail",
  AUDIT_TRAIL_SENSITIVE_READ: "Datos sensibles del audit trail",
};

/** Módulos del editor de roles, en el orden del menú, con Sistema al final. */
export const roleEditorModules: readonly { key: AccessModule; label: string }[] = [
  ...qmsModules.map(contract => ({ key: contract.key, label: contract.labels.plural })),
  { key: "SYSTEM", label: "Sistema" },
];

/** Permisos de Sistema que un rol puede recibir; la gestión de usuarios queda reservada al rol técnico. */
const systemAssignable: readonly AccessPermission[] = ["READ", "MANAGE_CONFIGURATION", "AUDIT_TRAIL_REVIEW", "AUDIT_TRAIL_EXPORT", "AUDIT_TRAIL_SENSITIVE_READ"];
/** Permisos que solo admiten ámbito «Todos». */
export const allScopeOnlyPermissions: readonly AccessPermission[] = ["EXPORT", "IMPORT", "MANAGE_CONFIGURATION", "AUDIT_TRAIL_REVIEW", "AUDIT_TRAIL_EXPORT", "AUDIT_TRAIL_SENSITIVE_READ"];

/** Permisos que el editor ofrece para un módulo: los que admite su contrato, salvo usuarios y roles. */
export function assignablePermissions(module: AccessModule): readonly AccessPermission[] {
  if (module === "SYSTEM") return systemAssignable;
  return permissionsForModule(module).filter(permission => permission !== "MANAGE_USERS");
}

/** Motivo por el que una concesión no se admite en una política de rol, o `null`. */
export function roleGrantError(grant: Grant): string | null {
  const moduleLabel = roleEditorModules.find(m => m.key === grant.module)?.label ?? grant.module;
  if (!assignablePermissions(grant.module).includes(grant.permission)) return `${moduleLabel} no admite el permiso «${permissionLabels[grant.permission]}».`;
  if (grant.scope === "ASSIGNED" && allScopeOnlyPermissions.includes(grant.permission)) return `«${permissionLabels[grant.permission]}» solo admite el ámbito Todos.`;
  return null;
}

/** Concesiones marcadas en el formulario del editor: `grant` = `MÓDULO:PERMISO`, ámbito en `scope:MÓDULO:PERMISO`. */
export function grantsFromForm(form: FormData) {
  return form.getAll("grant").map(String).map(value => {
    const [moduleKey, permission] = value.split(":");
    return { module: moduleKey, permission, scope: String(form.get(`scope:${value}`) || "ALL") };
  });
}
