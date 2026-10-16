import { describe, expect, it } from "vitest";
import {
  changeControlDetailTabs,
  changeControlDocumentUrls,
  changeControlVersionDocumentUrls,
  changeRequirementRows,
  dictamenResultTone,
  displayValue,
  requestDecisionTone,
} from "@/modules/change-control/detail-ui";

describe("modelo visual del expediente de Control de Cambios · CC2", () => {
  it("mantiene el orden de pestañas y las pestañas operativas existentes", () => {
    expect(changeControlDetailTabs).toEqual([
      ["information", "Información"],
      ["request", "Solicitud"],
      ["dictamen", "Dictamen"],
      ["followups", "Seguimiento"],
      ["documents", "Documentos"],
      ["relations", "Relaciones"],
      ["review", "Revisión"],
      ["timeline", "Cronología"],
      ["audit-trail", "Audit Trail"],
      ["history", "Historial"],
    ]);
  });

  it("asocia cada requisito con evaluación y detalle", () => {
    const rows = changeRequirementRows({
      committeeRequired: true,
      committeeDetails: "Comité QA",
      clientNotificationRequired: false,
      clientNotificationDetails: null,
      authorityRequired: null,
      authorityDetails: null,
      pqrRequired: "YES",
      pqrProducts: "Producto A",
      pqrPeriod: "2026",
      stabilityRequired: "YES",
      stabilityAccelerated: true,
      stabilityOngoing: false,
      additionalAnalysisRequired: "NO",
      additionalAnalysisDetails: null,
      additionalValidationRequired: "NA",
      additionalValidationDetails: null,
      otherImplicationRequired: false,
      otherImplicationDetails: null,
    });

    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({
      key: "committee",
      question: "¿Se requiere Comité de cambios?",
      evaluation: "Sí",
      detail: "Comité QA",
    });
    expect(rows[3].detail).toBe("Productos: Producto A · Periodo: 2026");
    expect(rows[4].detail).toBe("Acelerada");
  });

  it("representa históricos incompletos de forma discreta", () => {
    const rows = changeRequirementRows({
      committeeRequired: null,
      committeeDetails: null,
      clientNotificationRequired: null,
      clientNotificationDetails: null,
      authorityRequired: null,
      authorityDetails: null,
      pqrRequired: null,
      pqrProducts: null,
      pqrPeriod: null,
      stabilityRequired: null,
      stabilityAccelerated: false,
      stabilityOngoing: false,
      additionalAnalysisRequired: null,
      additionalAnalysisDetails: null,
      additionalValidationRequired: null,
      additionalValidationDetails: null,
      otherImplicationRequired: null,
      otherImplicationDetails: null,
    });

    expect(rows.every((row) => row.evaluation === "—" && row.detail === "—")).toBe(true);
    expect(displayValue(undefined)).toBe("—");
  });

  it("usa tonos existentes y texto además del color para decisiones", () => {
    expect(requestDecisionTone("PENDING")).toBe("warning");
    expect(requestDecisionTone("ACCEPTED")).toBe("closed");
    expect(requestDecisionTone("DENIED")).toBe("major");
    expect(dictamenResultTone("APPROVED")).toBe("closed");
    expect(dictamenResultTone("REJECTED")).toBe("major");
  });

  it("conserva las acciones documentales existentes", () => {
    expect(changeControlDocumentUrls("change-1")).toEqual({
      annexIII: "/api/changes/change-1/annex-iii",
      annexIV: "/api/changes/change-1/annex-iv",
      annexVII: "/changes",
    });
    expect(changeControlVersionDocumentUrls("change-1", 2)).toEqual({
      annexIII: "/api/changes/change-1/annex-iii?version=2",
      annexIV: "/api/changes/change-1/annex-iv?version=2",
      annexV: "/api/changes/change-1/annex-v?version=2",
    });
  });
});
