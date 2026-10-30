import { describe, expect, it } from "vitest";
import { serializeCapaVersion, serializeChangeControlVersion } from "@/lib/qms/versioning";

const tables = { rootCause: [{ title: "Causas", columns: ["Causa"], rows: [["Compresor"]] }] };
const capa = { qmsRecord: { businessCode: "CAPA/001/2026", year: 2026, targetRelations: [] }, plannedActions: [], actionFollowups: [], followups: [] };
const change = { qmsRecord: { businessCode: "CC/001/2026", year: 2026 }, scope: [], tasks: [], followups: [] };

describe("CAPA y Controles de cambios · tablas de los textos en la versión (D-127)", () => {
  it("la foto de la versión conserva las tablas; sin ellas queda null", () => {
    expect(serializeCapaVersion({ ...capa, textTables: tables } as never).capa.textTables).toEqual(tables);
    expect(serializeCapaVersion(capa as never).capa.textTables).toBeNull();
    expect(serializeChangeControlVersion({ ...change, textTables: tables } as never).changeControl.textTables).toEqual(tables);
    expect(serializeChangeControlVersion(change as never).changeControl.textTables).toBeNull();
  });
});
