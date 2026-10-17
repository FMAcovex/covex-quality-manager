import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permissions, type AccessModule, type AccessPermission } from "@/lib/auth/context";
import inventory from "@/lib/auth/operation-inventory.json";
import { permissionsForModule, qmsModuleByPathSegment, qmsModules, qmsRecordModuleKeys, systemPermissions } from "@/modules/registry";

// Directorios de código propios de cada módulo de autorización.
const appSegments: Record<string, AccessModule> = { ...qmsModuleByPathSegment, settings: "SYSTEM", "audit-trail": "SYSTEM" };
const moduleDirs: Record<string, AccessModule> = {
  deviations: "DEVIATION",
  capa: "CAPA",
  "change-control": "CHANGE_CONTROL",
  complaints: "COMPLAINT",
  returns: "RETURN",
  audits: "AUDIT",
  oos: "OOS",
  "controlled-documents": "PNT",
  configuration: "SYSTEM",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Pares módulo/permiso que el código comprueba, obtenidos de forma estática. */
function checkedPermissions() {
  const used = new Map<AccessModule, Set<string>>();
  const add = (module: string, permission: string) => {
    const set = used.get(module as AccessModule) ?? new Set<string>();
    set.add(permission);
    used.set(module as AccessModule, set);
  };
  // 1. Inventario de Server Actions y rutas; QMS resuelve cualquier módulo con expediente.
  for (const entry of [...inventory.actions, ...inventory.routes] as Array<{ module?: string; permission?: string }>) {
    if (!entry.module || !entry.permission) continue;
    for (const accessModule of entry.module === "QMS" ? qmsRecordModuleKeys : [entry.module]) add(accessModule, entry.permission);
  }
  // 2. Operaciones de ciclo de vida PNT resueltas en la frontera de rutas.
  const routeGuard = readFileSync("src/lib/auth/route-guard.ts", "utf8");
  for (const [, permission] of routeGuard.matchAll(/"(PNT_[A-Z_]+)"/g)) add("PNT", permission);
  // 3. PermissionGate en páginas y componentes de cada módulo (respetando module="…").
  const gates = [
    ...Object.entries(appSegments).map(([dir, module]) => [join("src/app", dir), module] as const),
    ...Object.entries(moduleDirs).map(([dir, module]) => [join("src/modules", dir), module] as const),
  ];
  for (const [dir, module] of gates) {
    for (const file of sourceFiles(dir)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/permission=\{?\[?((?:"[A-Z_]+",?\s*)+)/g)) {
        const explicit = source.slice(match.index! + match[0].length, match.index! + match[0].length + 80).match(/module="([A-Z_]+)"/);
        for (const [, permission] of match[1].matchAll(/"([A-Z_]+)"/g)) add(explicit?.[1] ?? module, permission);
      }
    }
  }
  // 4. Comprobaciones explícitas con módulo y permiso literales.
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const [, module, permission] of source.matchAll(/(?:assertPermission|canPresent)\([^,()]+, *"([A-Z_]+)", *"([A-Z_]+)"/g)) add(module, permission);
  }
  return used;
}

describe("Contrato de módulo QMS — permisos (PR 4)", () => {
  const used = checkedPermissions();

  it("declara en cada módulo todos los permisos que el código comprueba para él", () => {
    for (const [module, set] of used) {
      expect(set.size, module).toBeGreaterThan(0);
      for (const permission of set) expect(permissionsForModule(module), `${module} · ${permission}`).toContain(permission);
    }
  });

  it("el análisis estático cubre todos los módulos registrados y SYSTEM", () => {
    expect([...used.keys()].sort()).toEqual([...qmsModules.map((contract) => contract.key), "SYSTEM"].sort());
  });

  it("reserva los permisos específicos a su módulo", () => {
    const owners: Array<[RegExp, AccessModule]> = [[/^PNT_/, "PNT"], [/^AUDIT_ISSUE_/, "AUDIT"], [/^AUDIT_TRAIL_/, "SYSTEM"]];
    for (const accessModule of [...qmsModules.map((contract) => contract.key), "SYSTEM"] as AccessModule[]) {
      for (const permission of permissionsForModule(accessModule)) {
        const owner = owners.find(([pattern]) => pattern.test(permission))?.[1];
        if (owner) expect(accessModule, permission).toBe(owner);
      }
    }
  });

  it("solo declara permisos existentes, sin duplicados, y todos tienen al menos un módulo", () => {
    const declared = new Set<AccessPermission>();
    for (const list of [...qmsModules.map((contract) => contract.permissions), systemPermissions]) {
      expect(new Set(list).size).toBe(list.length);
      for (const permission of list) {
        expect(permissions).toContain(permission);
        declared.add(permission);
      }
    }
    expect([...declared].sort()).toEqual([...permissions].sort());
  });

  it("reproduce el mapa de segmentos de ruta de page-guard", () => {
    expect({ ...qmsModuleByPathSegment, settings: "SYSTEM", "audit-trail": "DEVIATION" }).toEqual({
      deviations: "DEVIATION",
      capa: "CAPA",
      changes: "CHANGE_CONTROL",
      complaints: "COMPLAINT",
      returns: "RETURN",
      audits: "AUDIT",
      oos: "OOS",
      "controlled-documents": "PNT",
      settings: "SYSTEM",
      "audit-trail": "DEVIATION",
    });
  });
});
