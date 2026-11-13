import { expect, it } from "vitest";
import { complaintListWhere } from "./list-filters";

// FEC1: un seguimiento previsto para «hoy» en Madrid no está vencido, aunque en UTC aún sea el día anterior.
it("compares follow-up dates with the Madrid day, not the UTC day", () => {
  const where = JSON.stringify(complaintListWhere({ followup: ["OVERDUE"] }, new Date("2026-11-12T23:30:00.000Z")));
  expect(where).toContain('"lt":"2026-11-13T00:00:00.000Z"');
});
