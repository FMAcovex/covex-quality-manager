import { describe, expect, it } from "vitest";
import { deadlineLabel, deviationProvenanceLabel, deviationProvenanceOptions, measuresLabel } from "@/modules/deviations/domain";

describe("deviationProvenanceLabel", () => {
  it.each([
    ["FINISHED_PRODUCT_SYSTEM", "Producto terminado / Sistema"],
    ["CLIENT", "Cliente"],
    ["RAW_PACKAGING_MATERIAL", "Materia prima / Material de acondicionamiento"],
    ["SUPPLIER", "Proveedor"],
    ["EQUIPMENT_LINE", "Equipo / Línea afectada"],
    ["OTHER", "Otros"],
  ])("labels %s without changing the stored filter value", (value, label) => {
    expect(deviationProvenanceLabel(value)).toBe(label);
    expect(deviationProvenanceOptions.find((option) => option.value === value)).toEqual({ value, label });
  });

  it("preserves free-text historical provenance and handles absent values", () => {
    expect(deviationProvenanceLabel("Origen histórico")).toBe("Origen histórico");
    for (const value of [null, undefined, "", "  "]) expect(deviationProvenanceLabel(value)).toBe("—");
  });
});

describe("measuresLabel", () => {
  it("derives the operational measure without duplicating capture", () => {
    expect(measuresLabel({ immediateActions: [], capaPlans: [] })).toBe("Ninguna");
    expect(measuresLabel({ immediateActions: [{}], capaPlans: [] })).toBe("Correctiva inmediata");
    expect(measuresLabel({ immediateActions: [], capaPlans: [{}] })).toBe("CAPA");
    expect(measuresLabel({ immediateActions: [{}], capaPlans: [{}] })).toBe("Correctiva inmediata + CAPA");
  });
});

describe("deadlineLabel", () => {
  it("does not invent a compliance result when deadlines are not configured", () => {
    expect(deadlineLabel("NOT_EVALUATED")).toBe("No evaluado");
  });
});
