import { describe, expect, it } from "vitest";
import { templateCatalog } from "./template-catalog";
import { parseTrialReference, TemplateTrialError, trialFileName, trialKind } from "./template-trial-rules";

describe("D-129: qué pide la prueba de cada plantilla", () => {
  it("todas las plantillas del catálogo se pueden probar", () => {
    const missing = [...new Set(templateCatalog.map((item) => item.documentType))].filter((type) => !trialKind(type));
    expect(missing).toEqual([]);
  });

  it("los listados anuales y los programas se prueban con un año; los demás, con un expediente", () => {
    expect(trialKind("DEVIATION_ANNEX_III")).toBe("record");
    expect(trialKind("CHANGE_ANNEX_V")).toBe("record");
    expect(trialKind("AUDIT_EXTERNAL_PLAN")).toBe("record");
    expect(trialKind("DEVIATION_ANNEX_V")).toBe("year");
    expect(trialKind("OOS_ANNEX_VI")).toBe("year");
    expect(trialKind("AUDIT_ANNUAL_INTERNAL_PROGRAMME")).toBe("year");
    expect(trialKind("SIMPLE_LIST")).toBeNull();
    expect(trialKind("RECORD_EVIDENCE")).toBeNull();
  });
});

describe("D-129: lectura del expediente o del año indicado", () => {
  const now = new Date(2027, 2, 15);

  it("sin código, el expediente más reciente; con código, ese código sin espacios", () => {
    expect(parseTrialReference("CAPA_ANNEX_III", null, now)).toEqual({ kind: "record", code: null });
    expect(parseTrialReference("CAPA_ANNEX_III", "   ", now)).toEqual({ kind: "record", code: null });
    expect(parseTrialReference("CAPA_ANNEX_III", " CAPA-001-2026 ", now)).toEqual({ kind: "record", code: "CAPA-001-2026" });
    expect(() => parseTrialReference("CAPA_ANNEX_III", "x".repeat(81), now)).toThrow(TemplateTrialError);
  });

  it("sin año, el año en curso; con año, ese año si es válido", () => {
    expect(parseTrialReference("CAPA_ANNEX_IV", "", now)).toEqual({ kind: "year", year: 2027, explicit: false });
    expect(parseTrialReference("CAPA_ANNEX_IV", "2025", now)).toEqual({ kind: "year", year: 2025, explicit: true });
    for (const bad of ["25", "1999", "2101", "2025a", "dos mil"]) {
      expect(() => parseTrialReference("CAPA_ANNEX_IV", bad, now), bad).toThrow("Indica un año válido");
    }
  });

  it("un documento sin plantilla que probar se rechaza", () => {
    expect(() => parseTrialReference("SIMPLE_LIST", null, now)).toThrow(TemplateTrialError);
  });
});

describe("D-129: nombre del archivo de prueba", () => {
  it("empieza por PRUEBA, lleva el documento y la versión, y no admite caracteres de ruta", () => {
    expect(trialFileName("DEVIATION_ANNEX_III", "07", "DES-001/2026", "docx")).toBe("PRUEBA_DEVIATION_ANNEX_III_v07_DES-001_2026.docx");
    expect(trialFileName("CAPA_ANNEX_IV", "05", "2026", "xlsx")).toBe("PRUEBA_CAPA_ANNEX_IV_v05_2026.xlsx");
    expect(trialFileName("CAPA_ANNEX_III", "../x", "\"; a", "docx")).toBe("PRUEBA_CAPA_ANNEX_III_v.._x_a.docx");
    expect(trialFileName("CAPA_ANNEX_III", "06", "///", "docx")).toBe("PRUEBA_CAPA_ANNEX_III_v06_sin_codigo.docx");
  });
});
