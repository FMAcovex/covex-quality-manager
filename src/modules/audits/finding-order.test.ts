import { describe, expect, it } from "vitest";
import { auditReportInclude } from "./report-service";
import { auditFindingInclude } from "./finding-queries";

// Con el mismo «orden visual», los hallazgos y sus acciones salen en su orden de alta (no por el id, que es aleatorio).
describe("orden de hallazgos y acciones de auditoría", () => {
  const tieBreak = [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }];
  it("informe y plan CAPA", () => {
    expect(auditReportInclude.findings.orderBy).toEqual(tieBreak);
    expect(auditReportInclude.findings.include.actions.orderBy).toEqual(tieBreak);
  });
  it("ficha de la auditoría", () => {
    expect(auditFindingInclude.actions.orderBy).toEqual(tieBreak);
  });
});
