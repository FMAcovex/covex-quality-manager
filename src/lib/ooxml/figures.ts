import { annexValueRunProperties, escapeXml } from "./xml";
import { getZipEntryText, updateZipEntry, type ZipEntry } from "./zip";

/** D-125: hoja «Figuras» que se añade al final de un documento Word generado, tras la última página. */
export type DocumentFigure = { number: number; caption: string; bytes: Buffer; mimeType: string };

const EMU_PER_PIXEL = 9525; // 96 ppp
const EMU_PER_TWIP = 635;

/** Ancho y alto en píxeles de un PNG (cabecera IHDR) o un JPEG (marcador SOF). */
export function imageSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString("ascii", 12, 16) === "IHDR") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  throw new Error("No se puede leer el tamaño de la figura.");
}

const paragraph = (text: string, { bold = false, center = false } = {}) =>
  `<w:p><w:pPr>${center ? '<w:jc w:val="center"/>' : ""}<w:spacing w:before="120" w:after="120"/></w:pPr><w:r>${annexValueRunProperties(bold ? "<w:rPr><w:b/></w:rPr>" : "")}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

function pictureParagraph(relationshipId: string, number: number, cx: number, cy: number) {
  return `<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${9000 + number}" name="Figura ${number}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${number}" name="figura-${number}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

/** Tamaño útil de la página según la última sección del documento (en EMU). */
function usableArea(sectPr: string) {
  const attr = (tag: string, name: string, fallback: number) => Number(sectPr.match(new RegExp(`<w:${tag}\\b[^>]*\\bw:${name}="(\\d+)"`))?.[1] ?? fallback);
  const width = attr("pgSz", "w", 11906) - attr("pgMar", "left", 1134) - attr("pgMar", "right", 1134);
  const height = attr("pgSz", "h", 16838) - attr("pgMar", "top", 1134) - attr("pgMar", "bottom", 1134);
  return { maxWidth: width * EMU_PER_TWIP, maxHeight: Math.round(height * EMU_PER_TWIP * 0.6) };
}

/**
 * Añade, tras el contenido de la plantilla (que no se modifica), un salto de página, el título y cada
 * figura con su pie. Sin figuras no cambia nada.
 */
export function appendFiguresPage(entries: ZipEntry[], figures: readonly DocumentFigure[], recordCode: string) {
  if (!figures.length) return;
  let documentXml = getZipEntryText(entries, "word/document.xml");
  const sectionAt = documentXml.lastIndexOf("<w:sectPr");
  if (sectionAt < 0) throw new Error("El documento no tiene sección final.");
  const { maxWidth, maxHeight } = usableArea(documentXml.slice(sectionAt));
  let relationships = getZipEntryText(entries, "word/_rels/document.xml.rels");
  let contentTypes = getZipEntryText(entries, "[Content_Types].xml");

  const parts = [`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`, paragraph(`Figuras del expediente ${recordCode}`, { bold: true, center: true })];
  for (const figure of figures) {
    const extension = figure.mimeType === "image/png" ? "png" : "jpeg";
    const id = `rIdCovexFigura${figure.number}`;
    const target = `media/covex-figura-${figure.number}.${extension}`;
    const { width, height } = imageSize(figure.bytes);
    const scale = Math.min(1, maxWidth / (width * EMU_PER_PIXEL), maxHeight / (height * EMU_PER_PIXEL));
    const cx = Math.round(width * EMU_PER_PIXEL * scale), cy = Math.round(height * EMU_PER_PIXEL * scale);
    entries.push({ name: `word/${target}`, data: figure.bytes });
    relationships = relationships.replace("</Relationships>", `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`);
    if (!new RegExp(`Extension="${extension}"`, "i").test(contentTypes)) {
      contentTypes = contentTypes.replace(/<Default\b/, `<Default Extension="${extension}" ContentType="${figure.mimeType}"/><Default`);
    }
    parts.push(pictureParagraph(id, figure.number, cx, cy), paragraph(`Figura ${figure.number}. ${figure.caption}`, { center: true }));
  }
  documentXml = documentXml.slice(0, sectionAt) + parts.join("") + documentXml.slice(sectionAt);
  updateZipEntry(entries, "word/document.xml", documentXml);
  updateZipEntry(entries, "word/_rels/document.xml.rels", relationships);
  updateZipEntry(entries, "[Content_Types].xml", contentTypes);
}
