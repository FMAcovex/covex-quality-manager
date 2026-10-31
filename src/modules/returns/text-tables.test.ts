import { describe, expect, it } from "vitest";
import { returnAnnexTablePlacements } from "./text-tables";

const table = (title: string) => ({ title, columns: ["a"], rows: [["b"]] });

describe("Devoluciones · tablas en el Anexo III (D-127)", () => {
  const tables = { reasonObservations: [table("Motivo")], ambientPeriodRiskJustification: [table("Plazo")], finalDestination: [table("Destino")] };
  const where = (placements: ReturnType<typeof returnAnnexTablePlacements>) => placements.flatMap((placement) => placement.tables.map((item) => [item.table.title, item.number]));

  it("la tabla de la justificación del plazo sale solo si su texto sale (como en el anexo); la numeración no cambia", () => {
    expect(where(returnAnnexTablePlacements(tables, "III", 1, { ambientJustification: false }))).toEqual([["Motivo", 1], ["Destino", 3]]);
    expect(where(returnAnnexTablePlacements(tables, "III", 1, { ambientJustification: true }))).toEqual([["Motivo", 1], ["Plazo", 2], ["Destino", 3]]);
  });
});
