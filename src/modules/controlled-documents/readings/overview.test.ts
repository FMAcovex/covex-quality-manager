import { describe, expect, it } from "vitest";
import { groupPendingReadings, parseOverviewFilters } from "./overview";

// D-141, entrega 2: panel de lecturas pendientes de todos los PNT.
const row = (over: Partial<Parameters<typeof groupPendingReadings>[0][number]>) => ({
  id: "r", documentId: "d1", baseCode: "GC-00/001", title: "Limpieza", revisionCode: "00", readerUserId: "u1", readerName: "Ana", dueDate: "2026-12-01", ...over,
});

describe("filtros del panel de lecturas", () => {
  it("lee la vista, la agrupación y los filtros; valores desconocidos vuelven al valor por defecto", () => {
    expect(parseOverviewFilters({})).toEqual({ view: "pending", group: "person", person: "", q: "", department: "", overdue: false });
    expect(parseOverviewFilters({ view: "assign", group: "pnt", person: "user:u1", q: " GC-00 ", department: "dep", overdue: "1" }))
      .toEqual({ view: "assign", group: "pnt", person: "user:u1", q: "GC-00", department: "dep", overdue: true });
    expect(parseOverviewFilters({ view: "x", group: "y" })).toMatchObject({ view: "pending", group: "person" });
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
