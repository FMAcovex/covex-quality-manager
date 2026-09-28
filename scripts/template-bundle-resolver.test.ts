import { describe, expect, it } from "vitest";
import { readZip, writeZip } from "../src/lib/ooxml/zip";
import { resolveBundleTemplate, sha256 } from "./template-bundle-resolver";

function minimalDocx() {
  return writeZip([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      ),
    },
    {
      name: "word/document.xml",
      data: Buffer.from(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
          '<w:p><w:r><w:t>Cabecera PNT</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t>Anexo IV: HOJA DE DEVOLUCIÓN DE PRODUCTO</w:t></w:r></w:p>' +
          '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>CONTENIDO IV</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
          '<w:p><w:r><w:t>Anexo V: DECLARACIÓN</w:t></w:r></w:p>' +
          '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>CONTENIDO V</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
          '<w:sectPr/></w:body></w:document>',
      ),
    },
  ]);
}

describe("template bundle resolver", () => {
  it("resuelve una plantilla directa usando el nombre original del ZIP", () => {
    const data = Buffer.from("plantilla-controlada");
    const entry = { name: "ANEXOS PARA APP/DESVIACIONES/Anexo V.xlsx", data };
    const result = resolveBundleTemplate(
      {
        relativePath: "templates/deviations/v06/Anexo V.xlsx",
        sources: [{
          kind: "direct",
          aliases: [
            "templates/deviations/v06/Anexo V.xlsx",
            "ANEXOS PARA APP/DESVIACIONES/Anexo V.xlsx",
          ],
          sha256: sha256(data),
        }],
      },
      [entry],
    );
    expect(result.data.equals(data)).toBe(true);
    expect(result.sourceName).toBe(entry.name);
    expect(result.derived).toBe(false);
  });

  it("extrae un anexo Word desde un PNT verificado", () => {
    const pnt = minimalDocx();
    const result = resolveBundleTemplate(
      {
        relativePath: "templates/returns/v03/Anexo IV Hoja Devolucion Producto 03.docx",
        sources: [{
          kind: "word-range",
          aliases: ["ANEXOS PARA APP/DEVOLUCIONES/PNT.docx"],
          sha256: sha256(pnt),
          startMarker: "Anexo IV:",
          endMarker: "Anexo V:",
        }],
      },
      [{ name: "ANEXOS PARA APP/DEVOLUCIONES/PNT.docx", data: pnt }],
    );
    const xml = readZip(result.data)
      .find((entry) => entry.name === "word/document.xml")
      ?.data.toString("utf8") ?? "";
    expect(result.derived).toBe(true);
    expect(xml).toContain("Anexo IV:");
    expect(xml).toContain("CONTENIDO IV");
    expect(xml).not.toContain("CONTENIDO V");
    expect(result.checksum).toBe(sha256(result.data));
  });
});
