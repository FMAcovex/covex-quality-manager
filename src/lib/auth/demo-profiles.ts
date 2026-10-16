/** Usuarios ficticios de la demo local (D-087), con el rol que muestra cada perfil. */
export const demoProfiles = [
  { id: "de000000-0000-4000-8000-000000000001", objectId: "de000000-0000-4000-8000-0000000000a1", name: "Demo · Garantía de Calidad", role: "QUALITY_ASSURANCE", description: "Todos los permisos de los siete módulos y la configuración." },
  { id: "de000000-0000-4000-8000-000000000002", objectId: "de000000-0000-4000-8000-0000000000a2", name: "Demo · Responsable de departamento", role: "DEPARTMENT_MANAGER", description: "Crea, edita y hace seguimiento en los expedientes de su departamento." },
  { id: "de000000-0000-4000-8000-000000000003", objectId: "de000000-0000-4000-8000-0000000000a3", name: "Demo · Consulta", role: "READER", description: "Consulta y descarga, sin modificar nada." },
  { id: "de000000-0000-4000-8000-000000000004", objectId: "de000000-0000-4000-8000-0000000000a4", name: "Demo · Administrador técnico", role: "TECHNICAL_ADMIN", description: "Usuarios y roles, sin acceso a modificar expedientes." },
] as const;
