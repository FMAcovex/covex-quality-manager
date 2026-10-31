import { describe, expect, it } from "vitest";
import { actionFollowupTablesKey, capaAnnexTablePlacements, capaTableFields, capaTableFieldsFor } from "./text-tables";

const table = (title: string) => ({ title, columns: ["a"], rows: [["b"]] });

describe("CAPA · tablas de los seguimientos de la acción (D-127)", () => {
  it("se numeran después de la causa raíz y antes de las observaciones del seguimiento, en el orden de las filas", () => {
    expect(capaTableFields(2)).toEqual(["defectDescription", "rootCause", "actionFollowups.0", "actionFollowups.1", "actionFollowupObservations", "operationalStatusDescription", "effectivenessAssessment", "conclusion", "internalObservations"]);
    expect(actionFollowupTablesKey(1)).toBe("actionFollowups.1");
    // Lo guardado cuenta aunque haya menos filas (no se pierde al comparar con el historial).
    expect(capaTableFieldsFor({ "actionFollowups.2": [table("X")] }, 1)).toContain("actionFollowups.2");
  });

  it("en el Anexo III, cada tabla va a la casilla de descripción de su fila copiada; las casillas de debajo bajan", () => {
    const placements = capaAnnexTablePlacements(
      { rootCause: [table("Causas")], "actionFollowups.0": [table("Primera")], "actionFollowups.2": [table("Tercera")], conclusion: [table("Cierre")] },
      3,
      [{ table: 0, row: 17, count: 1 }, { table: 1, row: 2, count: 3 }],
    );
    expect(placements.flatMap((placement) => placement.tables.map((item) => [item.table.title, item.number, placement.table, placement.row, placement.cell]))).toEqual([
      ["Causas", 1, 0, 14, 0],
      ["Cierre", 4, 1, 14, 0],
      ["Primera", 2, 1, 2, 1],
      ["Tercera", 3, 1, 4, 1],
    ]);
  });
});
