import { describe, expect, it } from "vitest";
import { oosClosingResults, oosEvaluationKeys, oosPhase, oosPhaseIEvaluationGroups, readOosEvaluation } from "./domain";
import { parseOosForm } from "./validation";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

const opening = {
  status: "OPEN",
  area: "MD",
  departmentId: "dep-gc10",
  issueDate: "2026-10-16",
  materialKind: "FINISHED_PRODUCT",
  materialName: "Producto ficticio 10 mg",
  lotNumber: "LOTE-DEMO-01",
  detectionDescription: "Valoración fuera de especificación en el control de liberación.",
};

const closedInPhaseI = {
  ...opening,
  status: "CLOSED",
  closedAt: "2026-10-20",
  phaseIDisposition: "LAB_ERROR",
  investigationResult: "INVALIDATED",
  phaseIConclusion: "Error de dilución confirmado; se invalida el resultado.",
  phaseIVerdict: "APPROVED",
  phaseIIssuedBy: "Analista ficticio",
  phaseIIssuedAt: "2026-10-19",
};

const closedInPhaseII = {
  ...opening,
  status: "CLOSED",
  closedAt: "2026-11-30",
  phaseIDisposition: "FULL_SCALE",
  investigationResult: "INCONCLUSIVE",
  phaseIIConclusion: "No se identifica causa raíz única.",
  phaseIIVerdict: "OTHER",
  phaseIIVerdictOther: "Disposición pendiente de purificación",
  phaseIIIssuedBy: "Garantía de Calidad ficticia",
  phaseIIIssuedAt: "2026-11-30",
};

describe("OOS — Anexo III, evaluación de la Fase I", () => {
  it("recoge los 21 parámetros del PNT 04 en cinco bloques, microbiología incluida", () => {
    expect(oosPhaseIEvaluationGroups.map((group) => [group.key, group.items.length])).toEqual([
      ["ANALYST", 5], ["SAMPLE", 4], ["EQUIPMENT", 4], ["REAGENTS", 5], ["MICROBIOLOGY", 3],
    ]);
    expect(new Set(oosEvaluationKeys).size).toBe(21);
  });

  it("guarda el resultado de cada parámetro como texto libre y descarta claves ajenas", () => {
    const parsed = parseOosForm(form({ "evaluation.methodCorrect": " Conforme ", "evaluation.microNegativeControl": "N/A", "evaluation.unknown": "x" }));
    expect(parsed.values.phaseIEvaluation).toEqual({ methodCorrect: "Conforme", microNegativeControl: "N/A" });
    expect(readOosEvaluation({ methodCorrect: "Sí", other: "x", sampleUsedCorrect: 3 })).toEqual({ methodCorrect: "Sí" });
    expect(readOosEvaluation(null)).toEqual({});
  });
});

describe("OOS — fases y resultado (árbol de decisiones, Anexo V)", () => {
  it("solo hay Fase II con disposición «a gran escala»", () => {
    expect(oosPhase(null)).toBe("I");
    expect(oosPhase("LAB_ERROR")).toBe("I");
    expect(oosPhase("FULL_SCALE")).toBe("II");
  });

  it("limita el resultado a Invalidado en Fase I y a Confirmado / No concluyente en Fase II", () => {
    expect(oosClosingResults("LAB_ERROR")).toEqual(["INVALIDATED"]);
    expect(oosClosingResults("FULL_SCALE")).toEqual(["CONFIRMED", "INCONCLUSIVE"]);
    expect(oosClosingResults(null)).toEqual([]);
    expect(parseOosForm(form({ ...opening, phaseIDisposition: "LAB_ERROR", investigationResult: "CONFIRMED" })).errors).toContain("El resultado de la investigación no corresponde a la disposición de la Fase I.");
    expect(parseOosForm(form({ ...opening, investigationResult: "INVALIDATED" })).errors).toContain("Indica la disposición de la Fase I antes del resultado de la investigación.");
  });

  it("rechaza datos de Fase II si la Fase I no deriva a investigación a gran escala", () => {
    expect(parseOosForm(form({ ...opening, phaseIDisposition: "LAB_ERROR", phaseIIConclusion: "x" })).errors).toContain("La Fase II solo se cumplimenta cuando la disposición de la Fase I es «Investigación a gran escala».");
    expect(parseOosForm(form({ ...opening, phaseIDisposition: "FULL_SCALE", phaseIIConclusion: "x" })).errors).toEqual([]);
  });
});

describe("OOS — validación de servidor", () => {
  it("admite un borrador vacío", () => {
    const parsed = parseOosForm(form({ status: "DRAFT" }));
    expect(parsed.errors).toEqual([]);
    expect(parsed.values.closedAt).toBeNull();
  });

  it("exige los datos iniciales para abrir el OOS", () => {
    const errors = parseOosForm(form({ status: "OPEN" })).errors;
    expect(errors).toEqual(expect.arrayContaining([
      "El área (API o MD) es obligatoria para abrir el OOS.",
      "La fecha de emisión es obligatoria para abrir el OOS.",
      "El material afectado es obligatorio.",
      "El n.º de lote es obligatorio.",
      "La descripción de la detección del OOS es obligatoria.",
    ]));
    expect(parseOosForm(form(opening)).errors).toEqual([]);
  });

  it("cierra en Fase I con conclusión, dictamen y emisión de Control de Calidad", () => {
    expect(parseOosForm(form(closedInPhaseI)).errors).toEqual([]);
    const errors = parseOosForm(form({ ...closedInPhaseI, phaseIVerdict: "", phaseIIssuedBy: "", closedAt: "" })).errors;
    expect(errors).toEqual(expect.arrayContaining([
      "Un OOS cerrado requiere fecha de cierre.",
      "El cierre en Fase I requiere el dictamen.",
      "El cierre en Fase I requiere quién emite el informe (Control de Calidad).",
    ]));
  });

  it("cierra en Fase II con conclusión, dictamen y emisión de Garantía de Calidad", () => {
    expect(parseOosForm(form(closedInPhaseII)).errors).toEqual([]);
    expect(parseOosForm(form({ ...closedInPhaseII, phaseIIVerdictOther: "" })).errors).toContain("Indica el dictamen «Otros» de la Fase II.");
    expect(parseOosForm(form({ ...closedInPhaseII, investigationResult: "" })).errors).toContain("Un OOS cerrado requiere el resultado de la investigación.");
  });

  it("valida fechas y hora en servidor", () => {
    const errors = parseOosForm(form({ status: "DRAFT", oosDate: "2026-02-30", oosTime: "25:00" })).errors;
    expect(errors).toEqual(["La fecha del OOS no es válida.", "La hora del OOS debe tener el formato HH:MM."]);
  });

  it("no conserva la fecha de cierre si el OOS no está cerrado", () => {
    const parsed = parseOosForm(form({ ...opening, closedAt: "2026-10-20" }));
    expect(parsed.values.closedAt).toBeNull();
  });
});

describe("errores por campo (D-117)", () => {
  it("asocia cada error de servidor con su campo", () => {
    const parsed = parseOosForm(form({ status: "OPEN" }));
    expect(parsed.fieldIssues.area).toEqual(["El área (API o MD) es obligatoria para abrir el OOS."]);
    expect(parsed.fieldIssues.lotNumber).toEqual(["El n.º de lote es obligatorio."]);
    expect(parsed.fieldIssues.materialKind).toBeDefined();
    expect(Object.values(parsed.fieldIssues).flat().sort()).toEqual([...parsed.errors].sort());
  });
});

describe("OOS · tablas de los textos (D-127)", () => {
  it("lee las tablas y un error de tabla bloquea en su campo, con el apartado en el resumen", () => {
    const fd = form({ ...opening, "textTables:phaseIInvestigation": JSON.stringify([{ title: "Resultados", columns: ["Ensayo", "Valor"], rows: [["Valoración", "93,1 %"]] }]) });
    expect(parseOosForm(fd).values.textTables).toEqual({ phaseIInvestigation: [{ title: "Resultados", columns: ["Ensayo", "Valor"], rows: [["Valoración", "93,1 %"]] }] });
    fd.set("textTables:phaseIIRetesting", JSON.stringify([{ title: "", columns: ["a"], rows: [["b"]] }]));
    const parsed = parseOosForm(fd);
    expect(parsed.fieldIssues.phaseIIRetesting).toEqual(["1.ª tabla: falta el título."]);
    expect(parsed.errors).toContain("Repetición de pruebas · 1.ª tabla: falta el título.");
    expect(parsed.values.textTables).toBeNull();
  });
});
