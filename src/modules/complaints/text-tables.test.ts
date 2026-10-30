import { describe, expect, it } from "vitest";
import { complaintAnnexTablePlacements } from "./text-tables";

const table = (title: string) => ({ title, columns: ["a"], rows: [["b"]] });
const where = (placements: ReturnType<typeof complaintAnnexTablePlacements>) =>
  placements.flatMap((placement) => placement.tables.map((item) => [item.table.title, item.number, placement.table, placement.row, placement.cell]));

describe("Reclamaciones · tablas en el Anexo III (D-127)", () => {
  const tables = { description: [table("Descripción")], recallActionDetails: [table("Lotes a retirar")], creditActionDetails: [table("Abonos")], otherResolutionDetails: [table("Otros")], conclusion: [table("Conclusión")] };

  it("v03: las tablas de un detalle de actuación salen solo si la actuación está marcada, como su texto; la numeración es la del expediente", () => {
    expect(where(complaintAnnexTablePlacements(tables, "v03", 1, ["CREDIT"]))).toEqual([
      ["Descripción", 1, 1, 13, 0],
      ["Abonos", 3, 1, 52, 1],
      ["Conclusión", 5, 1, 63, 0],
    ]);
    // «Otros» sale también con actuaciones sin casilla propia, como su texto.
    expect(where(complaintAnnexTablePlacements(tables, "v03", 3, ["RECALL", "SOMETHING_ELSE"])).map((item) => item.slice(0, 4))).toEqual([
      ["Descripción", 1, 1, 13],
      ["Lotes a retirar", 2, 1, 52],
      ["Otros", 4, 1, 52],
      ["Conclusión", 5, 1, 65],
    ]);
  });

  it("plantillas anteriores a la v03: sin casillas de detalle (su texto no se imprime) ; las CAPA copiadas no las mueven (ninguna queda debajo)", () => {
    const legacy = where(complaintAnnexTablePlacements({ ...tables, responseSummary: [table("Respuesta")] }, "legacy", 3, ["RECALL", "CREDIT", "OTHER"]));
    expect(legacy).toEqual([
      ["Descripción", 1, 1, 10, 0],
      ["Conclusión", 5, 3, 1, 0],
      ["Respuesta", 6, 5, 2, 0],
    ]);
  });
});
