import { describe, expect, it } from "vitest";
import { cleanText, continueBullet, isBulletLine, textBlocks, toggleBullets, type TextEdit } from "./bullets";

function apply(value: string, edit: TextEdit) {
  return value.slice(0, edit.from) + edit.text + value.slice(edit.to);
}

describe("isBulletLine", () => {
  it("solo cuenta las líneas que empiezan por «•»", () => {
    expect(isBulletLine("• Lote retenido")).toBe(true);
    expect(isBulletLine("•")).toBe(true);
    expect(isBulletLine("- Lote retenido")).toBe(false);
    expect(isBulletLine("  • sangrado")).toBe(false);
    expect(isBulletLine("•sin espacio")).toBe(false);
  });
});

describe("toggleBullets", () => {
  it("pone viñeta a la línea del cursor", () => {
    const value = "Hechos:\nSe detectó la alarma\nFin";
    const caret = value.indexOf("detectó");
    const edit = toggleBullets(value, caret, caret);
    expect(apply(value, edit)).toBe("Hechos:\n• Se detectó la alarma\nFin");
    expect(edit.selectionStart).toBe(caret + 2);
    expect(edit.selectionEnd).toBe(caret + 2);
  });

  it("pone viñeta a cada línea con texto de la selección y deja las vacías", () => {
    const value = "uno\n\ndos\ntres";
    const edit = toggleBullets(value, 0, value.length);
    expect(apply(value, edit)).toBe("• uno\n\n• dos\n• tres");
    expect([edit.selectionStart, edit.selectionEnd]).toEqual([0, "• uno\n\n• dos\n• tres".length]);
  });

  it("solo completa las líneas que no la tienen", () => {
    const value = "• uno\ndos";
    expect(apply(value, toggleBullets(value, 0, value.length))).toBe("• uno\n• dos");
  });

  it("quita las viñetas si todas las líneas la tienen", () => {
    const value = "• uno\n• dos";
    expect(apply(value, toggleBullets(value, 0, value.length))).toBe("uno\ndos");
    const caret = value.length;
    const edit = toggleBullets(value, caret, caret);
    expect(apply(value, edit)).toBe("• uno\ndos");
    expect(edit.selectionStart).toBe(caret - 2);
  });

  it("una línea vacía empieza la lista", () => {
    const value = "Texto\n";
    const edit = toggleBullets(value, value.length, value.length);
    expect(apply(value, edit)).toBe("Texto\n• ");
    expect(edit.selectionStart).toBe("Texto\n• ".length);
  });

  it("no toca la línea siguiente si la selección acaba justo al principio de ella", () => {
    const value = "uno\ndos\ntres";
    const edit = toggleBullets(value, 0, "uno\n".length);
    expect(apply(value, edit)).toBe("• uno\ndos\ntres");
  });

  it("en la primera línea de un texto que empieza por un salto de línea", () => {
    const edit = toggleBullets("\nTexto", 0, 0);
    expect(edit).toEqual({ from: 0, to: 0, text: "• ", selectionStart: 2, selectionEnd: 2 });
  });

  it("respeta los saltos de línea de Windows", () => {
    const value = "uno\r\ndos";
    expect(apply(value, toggleBullets(value, 0, value.length))).toBe("• uno\r\n• dos");
  });
});

describe("continueBullet", () => {
  it("Intro en una viñeta con texto crea la siguiente", () => {
    const value = "• Se retuvo el lote";
    const edit = continueBullet(value, value.length, value.length);
    expect(edit && apply(value, edit)).toBe("• Se retuvo el lote\n• ");
    expect(edit?.selectionStart).toBe(value.length + 3);
  });

  it("Intro en medio de una viñeta parte el texto en dos viñetas", () => {
    const value = "• uno dos";
    const caret = value.indexOf(" dos");
    const edit = continueBullet(value, caret, caret);
    expect(edit && apply(value, edit)).toBe("• uno\n•  dos");
  });

  it("Intro en una viñeta vacía termina la lista", () => {
    const value = "• uno\n• ";
    const edit = continueBullet(value, value.length, value.length);
    expect(edit && apply(value, edit)).toBe("• uno\n");
    expect(edit?.selectionStart).toBe("• uno\n".length);
  });

  it("deja el Intro normal fuera de una lista, delante de la viñeta o con selección", () => {
    expect(continueBullet("texto", 5, 5)).toBeNull();
    expect(continueBullet("• uno", 0, 0)).toBeNull();
    expect(continueBullet("• uno", 2, 4)).toBeNull();
  });
});

describe("textBlocks", () => {
  it("agrupa las viñetas seguidas y conserva el resto del texto", () => {
    expect(textBlocks("Hechos:\n• uno\n• dos\nConclusión\nfinal")).toEqual([
      { kind: "text", text: "Hechos:" },
      { kind: "bullets", items: ["uno", "dos"] },
      { kind: "text", text: "Conclusión\nfinal" },
    ]);
  });

  it("un texto sin viñetas es un solo bloque igual al original", () => {
    expect(textBlocks("- uno\r\n- dos")).toEqual([{ kind: "text", text: "- uno\r\n- dos" }]);
  });

  it("una línea en blanco antes o después de la lista se conserva igual a los dos lados", () => {
    expect(textBlocks("Texto\n\n• a\n\nFin")).toEqual([
      { kind: "text", text: "Texto" },
      { kind: "text", text: "" },
      { kind: "bullets", items: ["a"] },
      { kind: "text", text: "" },
      { kind: "text", text: "Fin" },
    ]);
  });

  it("no muestra viñetas vacías", () => {
    expect(textBlocks("• a\n•\n• \n• b")).toEqual([{ kind: "bullets", items: ["a", "b"] }]);
  });

  it("una línea vacía separa dos listas", () => {
    expect(textBlocks("• a\n\n• b")).toEqual([
      { kind: "bullets", items: ["a"] },
      { kind: "text", text: "" },
      { kind: "bullets", items: ["b"] },
    ]);
  });
});

describe("cleanText", () => {
  it("quita las viñetas vacías y los espacios de los extremos; sin texto, null", () => {
    expect(cleanText("  Texto\r\n• uno\r\n• \r\n•\t\r\n• dos\r\n• ")).toBe("Texto\r\n• uno\r\n• dos");
    expect(cleanText("• ")).toBeNull();
    expect(cleanText("\n•\n  ")).toBeNull();
    expect(cleanText("- guion")).toBe("- guion");
  });
});

