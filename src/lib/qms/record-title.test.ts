import { describe, expect, it } from "vitest";
import { draftRecordTitle } from "./record-title";

describe("Título de un borrador sin código", () => {
  it("usa el texto descriptivo en una línea", () => {
    expect(draftRecordTitle("  Alarma\n de  cámara ", "x")).toBe("Alarma de cámara");
  });
  it("recorta a 90 caracteres con puntos suspensivos", () => {
    const title = draftRecordTitle("a".repeat(120), "x");
    expect(title).toHaveLength(90);
    expect(title.endsWith("…")).toBe(true);
  });
  it("sin texto, usa el título por defecto", () => {
    expect(draftRecordTitle("", "CAPA sin código")).toBe("CAPA sin código");
    expect(draftRecordTitle(null, "Sin codificación")).toBe("Sin codificación");
  });
});
