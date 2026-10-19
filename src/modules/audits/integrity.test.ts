import { expect, it } from "vitest";
import { auditIntegrityIssues } from "./integrity";
import type { ReportAudit } from "./report-service";

const audit = (scenario: string, received = false) => ({ scenario, status: "CLOSED", performedDate: new Date("2026-10-01"), reportDate: new Date("2026-10-02"), conclusion: null, findings: [], supplierException: false,
  qmsRecord: { generatedDocuments: received ? [{ documentType: "AUDIT_RECEIVED" }] : [] } }) as unknown as ReportAudit;

it("en cliente e inspección no avisa de informe COVEX ni de conclusión (D-110, R5D)", () => {
  for (const scenario of ["CLIENT", "AUTHORITY"]) expect(auditIntegrityIssues(audit(scenario, true), 0, false)).toEqual([]);
  expect(auditIntegrityIssues(audit("CLIENT"), 0, false)).toEqual(["Documento externo primario sin registrar."]);
  expect(auditIntegrityIssues(audit("INTERNAL_COVEX"), 0, false)).toEqual(expect.arrayContaining(["Auditoría realizada sin informe formal emitido.", "Cierre sin conclusión."]));
});
