import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionGate, PermissionProvider } from "@/components/permissions";
import { presentationAccess } from "./presentation";
import type { Principal } from "./context";

const user: Principal = { id: "synthetic", tenantId: "tenant", objectId: "oid", name: "Usuario sintético", email: "scope@example.invalid", active: true, authorized: true, roles: [], departmentIds: ["own"], assignments: [], grants: [{ module: "DEVIATION", permission: "DOWNLOAD", scope: "ASSIGNED" }] };
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
function documents(principal: Principal) {
  return renderToStaticMarkup(React.createElement(PermissionProvider, { value: presentationAccess(principal, "DEVIATION", { id: "record", departmentIds: ["own"] }) },
    React.createElement(PermissionGate, { permission: "DOWNLOAD" }, React.createElement("a", { href: "/record/signed-pdf" }, "Archivo del expediente")),
    React.createElement(PermissionGate, { permission: "DOWNLOAD", module: "DEVIATION" }, React.createElement("a", { href: "/template/download" }, "Plantilla global")),
  ));
}
describe("presentación de descargas por ámbito", () => {
  it("descargar el expediente asignado no concede la descarga de una plantilla global", () => {
    const html = documents(user);
    expect(html).toContain("Archivo del expediente");
    expect(html).not.toContain("Plantilla global");
  });
  it("la concesión global conserva ambas descargas", () => {
    const html = documents({ ...user, grants: [{ module: "DEVIATION", permission: "DOWNLOAD", scope: "ALL" }] });
    expect(html).toContain("Archivo del expediente");
    expect(html).toContain("Plantilla global");
  });
});
