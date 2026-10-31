import { describe, expect, it } from "vitest";
import { permissions, type AccessPermission } from "./context";
import { allScopeOnlyPermissions, assignablePermissions, grantsFromForm, permissionLabels, roleEditorModules, roleGrantError } from "./role-policy";
import { permissionsForModule } from "@/modules/registry";

describe("Editor de roles — permisos por módulo", () => {
  it("ofrece en cada módulo solo los permisos de su contrato, nunca usuarios y roles", () => {
    for (const { key } of roleEditorModules) {
      for (const permission of assignablePermissions(key)) expect(permissionsForModule(key), `${key} · ${permission}`).toContain(permission);
      expect(assignablePermissions(key)).not.toContain("MANAGE_USERS");
    }
    expect(roleEditorModules.map(m => m.key)).toEqual(["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT", "OOS", "PNT", "SYSTEM"]);
  });

  it("D-130: «Configuración» se concede por módulo, porque activar sus plantillas, formularios y catálogos la exige en ese módulo", () => {
    // Las guardas resuelven el módulo de la plantilla (route-guard / action-guard): sin este permiso nadie podría activarla.
    for (const recordModule of ["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT", "OOS"] as const) {
      expect(roleGrantError({ module: recordModule, permission: "MANAGE_CONFIGURATION", scope: "ALL" }), recordModule).toBeNull();
      expect(roleGrantError({ module: recordModule, permission: "MANAGE_CONFIGURATION", scope: "ASSIGNED" }), recordModule).toContain("solo admite el ámbito Todos");
    }
  });

  it("rechaza en servidor un permiso que el módulo no admite y conserva las reglas anteriores", () => {
    expect(roleGrantError({ module: "DEVIATION", permission: "EDIT", scope: "ASSIGNED" })).toBeNull();
    expect(roleGrantError({ module: "DEVIATION", permission: "PNT_ACTIVATE", scope: "ALL" })).toMatch(/Desviaciones no admite/);
    expect(roleGrantError({ module: "PNT", permission: "FOLLOWUP", scope: "ALL" })).toMatch(/no admite/);
    expect(roleGrantError({ module: "SYSTEM", permission: "MANAGE_USERS", scope: "ALL" })).toMatch(/no admite/);
    expect(roleGrantError({ module: "SYSTEM", permission: "DOWNLOAD", scope: "ALL" })).toMatch(/no admite/);
    expect(roleGrantError({ module: "CAPA", permission: "EXPORT", scope: "ASSIGNED" })).toMatch(/solo admite el ámbito Todos/);
    for (const { key } of roleEditorModules) for (const permission of assignablePermissions(key)) {
      expect(roleGrantError({ module: key, permission, scope: "ALL" })).toBeNull();
      expect(roleGrantError({ module: key, permission, scope: "ASSIGNED" }) === null).toBe(!allScopeOnlyPermissions.includes(permission));
    }
  });

  it("todo permiso tiene nombre visible", () => {
    for (const permission of permissions as readonly AccessPermission[]) expect(permissionLabels[permission]).toBeTruthy();
  });

  it("lee las casillas marcadas con su ámbito", () => {
    const form = new FormData();
    form.append("grant", "DEVIATION:EDIT"); form.set("scope:DEVIATION:EDIT", "ASSIGNED");
    form.append("grant", "PNT:PNT_VERIFY"); form.set("scope:PNT:PNT_VERIFY", "ALL");
    form.set("scope:CAPA:CLOSE", "ASSIGNED");
    expect(grantsFromForm(form)).toEqual([{ module: "DEVIATION", permission: "EDIT", scope: "ASSIGNED" }, { module: "PNT", permission: "PNT_VERIFY", scope: "ALL" }]);
  });
});
