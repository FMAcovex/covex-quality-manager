import { describe, expect, it } from "vitest";
import { MAX_TOOL_CAUSES, emptyInvestigationTools, looseInvestigationTools, parseInvestigationTools, rootCauseSuggestion, storedInvestigationTools } from "./investigation-tools";

// D-123: herramientas de análisis guiadas en la investigación de Desviaciones.
const json = (value: unknown) => JSON.stringify(value);

describe("Herramientas de investigación (D-123)", () => {
  it("sin contenido no guarda nada: null", () => {
    expect(parseInvestigationTools(null)).toEqual({ tools: null });
    expect(parseInvestigationTools("")).toEqual({ tools: null });
    expect(parseInvestigationTools(json(emptyInvestigationTools()))).toEqual({ tools: null });
    // Filas en blanco que deja el formulario se ignoran.
    expect(parseInvestigationTools(json({ fiveWhys: { problem: " ", whys: ["", " "], status: "HYPOTHESIS" }, causes: [{ method: "BRAINSTORMING", category: null, text: " ", evidence: "", status: "HYPOTHESIS" }] }))).toEqual({ tools: null });
  });

  it("lee 5 porqués, Ishikawa y brainstorming; los porqués conservan su posición", () => {
    const parsed = parseInvestigationTools(json({
      fiveWhys: { problem: "Etiqueta errónea en el lote", whys: ["Se usó la plantilla anterior", "", "No se retiró del sistema"], status: "CONFIRMED" },
      causes: [
        { method: "ISHIKAWA", category: "METHOD", text: "Instrucción sin paso de verificación", evidence: "Revisión del PNT", status: "CONFIRMED" },
        { method: "BRAINSTORMING", category: null, text: "Cambio de turno", evidence: "", status: "DISCARDED" },
      ],
    }));
    expect(parsed.error).toBeUndefined();
    expect(parsed.tools?.fiveWhys).toEqual({ problem: "Etiqueta errónea en el lote", whys: ["Se usó la plantilla anterior", "", "No se retiró del sistema"], status: "CONFIRMED" });
    // Solo se quitan los huecos del final.
    expect(parseInvestigationTools(json({ fiveWhys: { problem: "P", whys: ["a", "", " ", ""], status: "HYPOTHESIS" } })).tools?.fiveWhys?.whys).toEqual(["a"]);
    expect(parsed.tools?.causes).toHaveLength(2);
  });

  it("valida en servidor: categoría 6M obligatoria en Ishikawa, estados y límites", () => {
    const cause = { method: "ISHIKAWA", category: "METHOD", text: "Causa", evidence: "", status: "HYPOTHESIS" };
    expect(parseInvestigationTools("{no es json").error).toBe("Las herramientas de investigación no son válidas.");
    expect(parseInvestigationTools(json({ causes: [{ ...cause, category: null }] })).error).toBe("Cada causa del Ishikawa necesita su categoría (6M).");
    expect(parseInvestigationTools(json({ causes: [{ ...cause, category: "UNDETERMINED" }] })).error).toBe("Categoría 6M no válida.");
    expect(parseInvestigationTools(json({ causes: [{ ...cause, status: "PROBABLE" }] })).error).toBe("Estado de la causa no válido.");
    expect(parseInvestigationTools(json({ causes: [{ ...cause, method: "IA" }] })).error).toBe("Herramienta no válida.");
    expect(parseInvestigationTools(json({ causes: Array.from({ length: MAX_TOOL_CAUSES + 1 }, () => cause) })).error).toBe(`Como máximo ${MAX_TOOL_CAUSES} causas.`);
    expect(parseInvestigationTools(json({ fiveWhys: { problem: "P", whys: ["1", "2", "3", "4", "5", "6"], status: "HYPOTHESIS" } })).error).toBe("Como máximo 5 porqués.");
    expect(parseInvestigationTools(json({ causes: [{ ...cause, text: "x".repeat(1001) }] })).error).toBe("Máximo 1000 caracteres.");
  });

  it("lo guardado que no encaja se ignora al leer", () => {
    expect(storedInvestigationTools(null)).toBeNull();
    expect(storedInvestigationTools({ causes: "no" })).toBeNull();
    expect(storedInvestigationTools({ fiveWhys: null, causes: [{ method: "BRAINSTORMING", category: null, text: "Idea", evidence: "", status: "HYPOTHESIS" }] })?.causes).toHaveLength(1);
  });

  it("«Usar como causa raíz» solo con causas confirmadas, y propone su categoría y su herramienta", () => {
    expect(rootCauseSuggestion({ method: "ISHIKAWA", category: "METHOD", text: "Instrucción sin verificación", evidence: "", status: "HYPOTHESIS" })).toBeNull();
    expect(rootCauseSuggestion({ method: "ISHIKAWA", category: "METHOD", text: "Instrucción sin verificación", evidence: "", status: "DISCARDED" })).toBeNull();
    expect(rootCauseSuggestion({ method: "ISHIKAWA", category: "METHOD", text: " Instrucción sin verificación ", evidence: "PNT", status: "CONFIRMED" }))
      .toEqual({ text: "Instrucción sin verificación", category: "METHOD", method: "ISHIKAWA" });
    expect(rootCauseSuggestion({ method: "BRAINSTORMING", category: null, text: "Idea", evidence: "", status: "CONFIRMED" }))
      .toEqual({ text: "Idea", category: null, method: "BRAINSTORMING" });
    // 5 porqués: el último porqué de una cadena confirmada.
    expect(rootCauseSuggestion({ problem: "P", whys: ["a", "b"], status: "CONFIRMED" })).toEqual({ text: "b", category: null, method: "FIVE_WHYS" });
    expect(rootCauseSuggestion({ problem: "P", whys: ["a", "b"], status: "HYPOTHESIS" })).toBeNull();
    expect(rootCauseSuggestion({ problem: "P", whys: [], status: "CONFIRMED" })).toBeNull();
  });

  it("un envío manipulado da un mensaje en español, nunca el de la librería", () => {
    for (const value of [{ causes: "x" }, { causes: [{ method: "ISHIKAWA", category: "METHOD", text: "C" }] }, { fiveWhys: { whys: "no" } }]) {
      expect(parseInvestigationTools(json(value)).error).toBe("Las herramientas de investigación no son válidas.");
    }
  });

  it("tras un guardado fallido recupera lo escrito aunque no sea válido, sin romperse con formas extrañas", () => {
    const written = { fiveWhys: null, causes: [{ method: "BRAINSTORMING", category: null, text: "", evidence: "Comprobado en el registro", status: "CONFIRMED" }] };
    expect(parseInvestigationTools(json(written)).error).toBe("Cada causa necesita una descripción.");
    expect(looseInvestigationTools(json(written))).toEqual(written);
    expect(looseInvestigationTools(json({ causes: "x", fiveWhys: { whys: "no" } }))).toEqual({ fiveWhys: { problem: "", whys: [], status: "HYPOTHESIS" }, causes: [] });
    expect(looseInvestigationTools(json({ causes: [{ method: "IA", category: "OTRA", text: 3, status: "PROBABLE" }] }))).toEqual({ fiveWhys: null, causes: [{ method: "BRAINSTORMING", category: null, text: "", evidence: "", status: "HYPOTHESIS" }] });
    expect(looseInvestigationTools("{roto")).toBeNull();
    expect(looseInvestigationTools(undefined)).toBeNull();
  });
});
