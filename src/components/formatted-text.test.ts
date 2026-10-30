import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormattedText } from "./formatted-text";

// El componente usa JSX; en vitest (entorno node, transformación clásica) necesita React global.
(globalThis as { React?: typeof React }).React = React;
const html = (props: Parameters<typeof FormattedText>[0]) => renderToStaticMarkup(React.createElement(FormattedText, props));

describe("FormattedText (D-126)", () => {
  it("un texto sin viñetas se muestra igual que antes, sin los espacios de los extremos", () => {
    expect(html({ value: "\n  Hechos del lote\r\nsegunda línea  \n" })).toBe("Hechos del lote\r\nsegunda línea");
    expect(html({ value: null })).toBe("—");
    expect(html({ value: "   " })).toBe("—");
  });

  it("las viñetas son una lista; las vacías no se muestran", () => {
    expect(html({ value: "Hechos:\r\n• uno & dos\r\n• \r\n• tres" })).toBe(
      '<span class="text-block">Hechos:</span><ul class="text-bullets"><li>uno &amp; dos</li><li>tres</li></ul>',
    );
    expect(html({ value: "• " })).toBe("—");
  });

  it("como div, para usarlo donde había un párrafo", () => {
    expect(html({ value: "• a", as: "div", className: "x" })).toBe('<div class="formatted-text x"><ul class="text-bullets"><li>a</li></ul></div>');
  });
});
