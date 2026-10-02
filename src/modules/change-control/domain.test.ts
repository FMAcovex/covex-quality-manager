import { describe, expect, it } from "vitest";
import {
  functionalStatusLabel,
  nextFollowupDateFromHistory,
} from "@/modules/change-control/domain";

const base = {
  finalStatus: "OPEN",
  requestDecision: "PENDING",
  dictamenResult: "PENDING",
  executionStatus: "NOT_EXECUTED",
  effectivenessStatus: "PENDING",
};

describe("estado funcional de Control de Cambios", () => {
  it.each([
    [{ ...base }, "Solicitud pendiente"],
    [{ ...base, requestDecision: "DENIED" }, "Solicitud denegada"],
    [{ ...base, requestDecision: "ACCEPTED" }, "Solicitud aceptada · Dictamen pendiente"],
    [{ ...base, requestDecision: "ACCEPTED", dictamenResult: "REJECTED" }, "Dictamen rechazado"],
    [{ ...base, requestDecision: "ACCEPTED", dictamenResult: "APPROVED" }, "Dictamen aprobado · Ejecución pendiente"],
    [{ ...base, requestDecision: "ACCEPTED", dictamenResult: "APPROVED", executionStatus: "EXECUTED" }, "Ejecutado · Eficacia pendiente"],
    [{ ...base, finalStatus: "DRAFT" }, "Borrador"],
    [{ ...base, finalStatus: "CLOSED", requestDecision: "ACCEPTED", dictamenResult: "APPROVED" }, "Cerrado"],
  ])("representa %o como %s", (record, expected) => {
    expect(functionalStatusLabel(record)).toBe(expected);
  });

  it("deriva el próximo seguimiento del seguimiento con mayor secuencia", () => {
    const date = nextFollowupDateFromHistory([
      { sequenceNumber: 0, nextFollowupDate: new Date("2026-10-10") },
      { sequenceNumber: 2, nextFollowupDate: new Date("2026-12-10") },
      { sequenceNumber: 1, nextFollowupDate: new Date("2026-11-10") },
    ]);

    expect(date).toEqual(new Date("2026-12-10"));
    expect(nextFollowupDateFromHistory([])).toBeNull();
  });
});
