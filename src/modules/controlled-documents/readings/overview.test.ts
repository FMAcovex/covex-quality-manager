import { describe, expect, it } from "vitest";
import type { Principal } from "@/lib/auth/context";
import { assignableCandidates, canAssignSomeReading, groupPendingReadings, parseOverviewFilters } from "./overview";

// D-141, entrega 2: panel de lecturas pendientes de todos los PNT.
const row = (over: Partial<Parameters<typeof groupPendingReadings>[0][number]>) => ({
  id: "r", documentId: "d1", baseCode: "GC-00/001", title: "Limpieza", revisionCode: "00", readerUserId: "u1", readerName: "Ana", dueDate: "2026-12-01", ...over,
});

describe("filtros del panel de lecturas", () => {
  it("lee la vista, la agrupación y los filtros; valores desconocidos vuelven al valor por defecto", () => {
    expect(parseOverviewFilters({})).toEqual({ view: "pending", group: "person", person: "", q: "", department: "", overdue: false });
    expect(parseOverviewFilters({ view: "assign", group: "pnt", person: "user:7f9c1c3e-8a59-4ef7-9a0e-3a5b8b1e2f10", q: " GC-00 ", department: "dep", overdue: "1" }))
      .toEqual({ view: "assign", group: "pnt", person: "user:7f9c1c3e-8a59-4ef7-9a0e-3a5b8b1e2f10", q: "GC-00", department: "dep", overdue: true });
    expect(parseOverviewFilters({ view: "x", group: "y" })).toMatchObject({ view: "pending", group: "person" });
    // Un usuario que no es un id válido se descarta (no rompe la consulta); un nombre externo se conserva.
    expect(parseOverviewFilters({ person: "user:abc" }).person).toBe("");
    expect(parseOverviewFilters({ person: "external:turno de noche" }).person).toBe("external:turno de noche");
    expect(parseOverviewFilters({ person: "otra cosa" }).person).toBe("");
  });
});

describe("agrupación de lecturas pendientes", () => {
  const rows = [
    row({ id: "1", readerName: "Bea", readerUserId: "u2", dueDate: "2026-11-20" }),
    row({ id: "2", readerName: "Ana", documentId: "d2", baseCode: "GC-00/002" }),
    row({ id: "3", readerName: "Ana" }),
    row({ id: "4", readerName: "turno  de noche", readerUserId: null }),
    row({ id: "5", readerName: "Turno de noche", readerUserId: null, documentId: "d2", baseCode: "GC-00/002" }),
  ];
  it("por persona: una persona externa con el mismo nombre es la misma; orden por nombre y, dentro, por plazo y código", () => {
    const groups = groupPendingReadings(rows, "person", "2026-11-26");
    expect(groups.map(g => [g.key, g.label, g.rows.map(r => r.id), g.overdue])).toEqual([
      ["user:u1", "Ana", ["3", "2"], 0],
      ["user:u2", "Bea", ["1"], 1],
      ["external:turno de noche", "turno  de noche", ["4", "5"], 0],
    ]);
    expect(groups[2].external).toBe(true);
  });
  it("por PNT: orden por código", () => {
    expect(groupPendingReadings(rows, "pnt", "2026-11-26").map(g => [g.key, g.label, g.rows.length, g.overdue])).toEqual([["d1", "GC-00/001", 3, 1], ["d2", "GC-00/002", 2, 0]]);
  });
});

describe("quién puede asignar lecturas y en qué PNT (revisión independiente, I-3)", () => {
  const principal = (grants: Principal["grants"], departmentIds: string[] = [], assignments: Principal["assignments"] = []): Principal => ({
    id: "u", tenantId: "t", objectId: "o", name: "Persona (ficticia)", email: "x@example.invalid", roles: [], grants, departmentIds, assignments, active: true, authorized: true,
  });
  const candidates = [{ id: "p1", departmentId: "X" }, { id: "p2", departmentId: "Y" }, { id: "p3", departmentId: null }];
  it("con ámbito total, todos los PNT", () => {
    const qa = principal([{ module: "PNT", permission: "EDIT", scope: "ALL" }]);
    expect(canAssignSomeReading(qa)).toBe(true);
    expect(assignableCandidates(qa, candidates).map(c => c.id)).toEqual(["p1", "p2", "p3"]);
  });
  it("con ámbito de departamento o asignación, solo los PNT de su departamento o asignados", () => {
    const manager = principal([{ module: "PNT", permission: "EDIT", scope: "ASSIGNED" }], ["X"], [{ module: "PNT", recordId: "p3" }]);
    expect(canAssignSomeReading(manager)).toBe(true);
    expect(assignableCandidates(manager, candidates).map(c => c.id)).toEqual(["p1", "p3"]);
  });
  it("sin editar PNT, ninguno y sin pestaña", () => {
    const reader = principal([{ module: "PNT", permission: "DOWNLOAD", scope: "ALL" }], ["X"]);
    expect(canAssignSomeReading(reader)).toBe(false);
    expect(assignableCandidates(reader, candidates)).toEqual([]);
  });
});
