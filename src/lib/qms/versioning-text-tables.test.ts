import { describe, expect, it } from "vitest";
import { capaSnapshotToAnnexRecord, changeControlSnapshotToRecord, complaintSnapshotToAnnexRecord, serializeCapaVersion, serializeChangeControlVersion, serializeComplaintVersion, serializeReturnVersion } from "@/lib/qms/versioning";
import { serializeOosVersion } from "@/modules/oos/signed-documents";
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
    expect(capaAnnexTablePlacements(storedTextTables(capaRecord.textTables), 0).map(({ table, row, cell }) => [table, row, cell])).toEqual([[0, 14, 0]]);
    const evaluation = { evaluation: [{ title: "Riesgos", columns: ["Riesgo"], rows: [["Bajo"]] }] };
    const changeSnapshot = JSON.parse(JSON.stringify(serializeChangeControlVersion({ ...change, textTables: evaluation } as never)));
    const changeRecord = changeControlSnapshotToRecord(changeSnapshot) as { textTables?: unknown };
    expect(changeControlAnnexTablePlacements(storedTextTables(changeRecord.textTables), "IV").map(({ table, row, cell }) => [table, row, cell])).toEqual([[0, 5, 0]]);
  });
});

describe("OOS, Reclamaciones y Devoluciones · tablas de los textos en la versión (D-127)", () => {
  it("la foto de la versión conserva las tablas y el anexo de una versión de reclamación las recibe", () => {
    const complaint = { qmsRecord: { businessCode: "R/001/2026", year: 2026, sourceRelations: [] }, capaPlans: [], derivedActions: [], followups: [], sourceTypes: [], scopeTypes: [], affectedObjectTypes: [], categoryTypes: [], resolutionActions: [], additionalLots: [] };
    const complaintSnapshot = JSON.parse(JSON.stringify(serializeComplaintVersion({ ...complaint, textTables: tables } as never)));
    expect(complaintSnapshot.complaint.textTables).toEqual(tables);
    expect((complaintSnapshotToAnnexRecord(complaintSnapshot) as { textTables?: unknown }).textTables).toEqual(tables);
    expect(serializeComplaintVersion(complaint as never).complaint.textTables).toBeNull();
    const returnRecord = { qmsRecord: { businessCode: "DV/001/2026", year: 2026, targetRelations: [] }, products: [], followups: [] };
    expect(serializeReturnVersion({ ...returnRecord, textTables: tables } as never).returnRecord.textTables).toEqual(tables);
    expect(serializeReturnVersion(returnRecord as never).returnRecord.textTables).toBeNull();
    const oos = { qmsRecord: { businessCode: "OOS/001/2026", year: 2026, sourceRelations: [] }, textTables: tables };
    expect(serializeOosVersion(oos as never).oos.textTables).toEqual(tables);
  });
});

