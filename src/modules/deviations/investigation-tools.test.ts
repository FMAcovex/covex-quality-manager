import { describe, expect, it } from "vitest";
import { MAX_TOOL_CAUSES, emptyInvestigationTools, ftaSuggestion, looseInvestigationTools, parseInvestigationTools, rootCauseAnnexText, rootCauseSuggestion, storedInvestigationTools } from "./investigation-tools";

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
    const written = { fiveWhys: null, causes: [{ method: "BRAINSTORMING", category: null, text: "", evidence: "Comprobado en el registro", status: "CONFIRMED" }], fta: null };
    expect(parseInvestigationTools(json(written)).error).toBe("Cada causa necesita una descripción.");
    expect(looseInvestigationTools(json(written))).toEqual(written);
    expect(looseInvestigationTools(json({ causes: "x", fiveWhys: { whys: "no" } }))).toEqual({ fiveWhys: { problem: "", whys: [], status: "HYPOTHESIS" }, causes: [], fta: null });
    expect(looseInvestigationTools(json({ causes: [{ method: "IA", category: "OTRA", text: 3, status: "PROBABLE" }] }))).toEqual({ fiveWhys: null, causes: [{ method: "BRAINSTORMING", category: null, text: "", evidence: "", status: "HYPOTHESIS" }], fta: null });
    expect(looseInvestigationTools("{roto")).toBeNull();
    expect(looseInvestigationTools(undefined)).toBeNull();
  });
});

describe("FTA: árbol de fallos con sangrías (D-124)", () => {
  const node = (depth: number, text: string, extra: Record<string, unknown> = {}) => ({ depth, text, evidence: "", status: "HYPOTHESIS", gate: "OR", ...extra });
  const tree = (nodes: unknown[]) => json({ fta: { top: "Lote con etiqueta errónea", nodes } });

  it("lee el evento principal y las causas en esquema; sin contenido no guarda nada", () => {
    const parsed = parseInvestigationTools(tree([node(1, "Plantilla incorrecta", { gate: "AND" }), node(2, "Versión anterior disponible"), node(2, "Sin verificación"), node(1, "Error de impresora")]));
    expect(parsed.error).toBeUndefined();
    expect(parsed.tools?.fta?.nodes.map((n) => [n.depth, n.text, n.gate])).toEqual([[1, "Plantilla incorrecta", "AND"], [2, "Versión anterior disponible", "OR"], [2, "Sin verificación", "OR"], [1, "Error de impresora", "OR"]]);
    expect(parseInvestigationTools(json({ fta: { top: " ", nodes: [node(1, " ")] } }))).toEqual({ tools: null });
  });

  it("valida la forma del árbol: empieza en el primer nivel, no salta niveles y como máximo 4", () => {
    expect(parseInvestigationTools(tree([node(2, "Sin padre")])).error).toBe("El árbol de fallos no es válido: cada causa cuelga del nivel anterior.");
    expect(parseInvestigationTools(tree([node(1, "A"), node(3, "Salta un nivel")])).error).toBe("El árbol de fallos no es válido: cada causa cuelga del nivel anterior.");
    expect(parseInvestigationTools(tree([node(1, "A"), node(2, "B"), node(3, "C"), node(4, "D"), node(5, "E")])).error).toBe("Como máximo 4 niveles en el árbol de fallos.");
    expect(parseInvestigationTools(tree([node(1, "A", { gate: "XOR" })])).error).toBe("Relación entre causas no válida.");
  });

  it("solo una causa final (sin causas debajo) y confirmada se puede usar como causa raíz, con la metodología FTA", () => {
    const parsed = parseInvestigationTools(tree([node(1, "Plantilla incorrecta", { status: "CONFIRMED" }), node(2, "Versión anterior disponible", { status: "CONFIRMED" }), node(1, "Error de impresora", { status: "HYPOTHESIS" })]));
    const fta = parsed.tools!.fta!;
    expect(ftaSuggestion(fta, 0)).toBeNull();
    expect(ftaSuggestion(fta, 1)).toEqual({ text: "Versión anterior disponible", category: null, method: "FTA" });
    expect(ftaSuggestion(fta, 2)).toBeNull();
  });

  it("recupera un árbol escrito aunque no sea válido", () => {
    expect(looseInvestigationTools(json({ fta: { top: 3, nodes: [{ depth: 9, text: "x", gate: "Y" }, "raro"] } }))?.fta).toEqual({ top: "", nodes: [{ depth: 4, text: "x", evidence: "", status: "HYPOTHESIS", gate: "OR" }] });
  });
});

describe("Texto de las herramientas para la casilla de causa raíz del Anexo III (D-124)", () => {
  it("imprime todas las herramientas usadas, con estado y evidencia, debajo de la causa raíz", () => {
    const tools = parseInvestigationTools(json({
      fiveWhys: { problem: "Tres días sin firma", whys: ["Supervisor de vacaciones", "", "Sin suplente en el formato"], status: "CONFIRMED" },
      causes: [
        { method: "ISHIKAWA", category: "MACHINE", text: "Fallo del compresor", evidence: "Histórico revisado", status: "CONFIRMED" },
        { method: "ISHIKAWA", category: "PEOPLE", text: "Puerta mal cerrada", evidence: "Sin aperturas en el registro", status: "DISCARDED" },
        { method: "BRAINSTORMING", category: null, text: "Cambio de turno", evidence: "", status: "HYPOTHESIS" },
      ],
      fta: { top: "Temperatura fuera de rango", nodes: [{ depth: 1, text: "Fallo de frío", evidence: "", status: "CONFIRMED", gate: "AND" }, { depth: 2, text: "Compresor parado", evidence: "Registro del equipo", status: "CONFIRMED", gate: "OR" }] },
    })).tools;
    expect(rootCauseAnnexText("Formato sin suplente de verificación.", tools).split("\n")).toEqual([
      "Formato sin suplente de verificación.",
      "",
      "Análisis — 5 porqués (confirmada)",
      "Problema: Tres días sin firma",
      "1. ¿Por qué? Supervisor de vacaciones",
      "2. ¿Por qué? —",
      "3. ¿Por qué? Sin suplente en el formato",
      "",
      "Análisis — Ishikawa (6M)",
      "Mano de obra: Puerta mal cerrada (descartada; evidencia: Sin aperturas en el registro)",
      "Máquina: Fallo del compresor (confirmada; evidencia: Histórico revisado)",
      "",
      "Análisis — Brainstorming",
      "- Cambio de turno (hipótesis)",
      "",
      "Análisis — FTA (árbol de fallos)",
      "Evento principal: Temperatura fuera de rango",
      "- Fallo de frío (confirmada) — sus causas: todas a la vez (Y)",
      "    - Compresor parado (confirmada; evidencia: Registro del equipo)",
    ]);
  });

  it("sin herramientas queda la causa raíz tal cual; sin causa raíz, solo el análisis", () => {
    expect(rootCauseAnnexText("Causa", null)).toBe("Causa");
    expect(rootCauseAnnexText(null, null)).toBe("");
    const tools = parseInvestigationTools(json({ causes: [{ method: "BRAINSTORMING", category: "METHOD", text: "Idea", evidence: "", status: "HYPOTHESIS" }] })).tools;
    expect(rootCauseAnnexText(null, tools)).toBe("Análisis — Brainstorming\n- Idea [Método] (hipótesis)");
  });
});
