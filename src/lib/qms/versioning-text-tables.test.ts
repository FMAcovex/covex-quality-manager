import { describe, expect, it } from "vitest";
import { capaSnapshotToAnnexRecord, changeControlSnapshotToRecord, serializeCapaVersion, serializeChangeControlVersion } from "@/lib/qms/versioning";
import { capaAnnexTablePlacements } from "@/modules/capa/text-tables";
import { changeControlAnnexTablePlacements } from "@/modules/change-control/text-tables";
import { storedTextTables } from "@/lib/forms/text-tables";

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

describe("CAPA y Controles de cambios · las tablas de una versión llegan a su anexo (D-127)", () => {
  it("de la foto guardada (JSON) al registro del anexo y a su casilla", () => {
    const capaSnapshot = JSON.parse(JSON.stringify(serializeCapaVersion({ ...capa, textTables: tables } as never)));
    const capaRecord = capaSnapshotToAnnexRecord(capaSnapshot) as { textTables?: unknown };
    expect(capaAnnexTablePlacements(storedTextTables(capaRecord.textTables)).map(({ table, row, cell }) => [table, row, cell])).toEqual([[0, 14, 0]]);
    const evaluation = { evaluation: [{ title: "Riesgos", columns: ["Riesgo"], rows: [["Bajo"]] }] };
    const changeSnapshot = JSON.parse(JSON.stringify(serializeChangeControlVersion({ ...change, textTables: evaluation } as never)));
    const changeRecord = changeControlSnapshotToRecord(changeSnapshot) as { textTables?: unknown };
    expect(changeControlAnnexTablePlacements(storedTextTables(changeRecord.textTables), "IV").map(({ table, row, cell }) => [table, row, cell])).toEqual([[0, 5, 0]]);
  });
});

