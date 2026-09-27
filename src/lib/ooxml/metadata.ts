import type { ZipEntry } from "@/lib/ooxml/zip";
import { getZipEntryText, updateZipEntry } from "@/lib/ooxml/zip";

function blankTag(xml: string, tag: string) {
  const escaped = tag.replace(":", "\\:");
  const re = new RegExp(`<${escaped}([^>]*)>[\\s\\S]*?<\\/${escaped}>`, "g");
  return xml.replace(re, `<${tag}$1></${tag}>`);
}

export function sanitizeOfficeMetadata(entries: ZipEntry[]) {
  const core = entries.find((entry) => entry.name === "docProps/core.xml");
  if (core) {
    let xml = core.data.toString("utf8");
    xml = blankTag(xml, "dc:creator");
    xml = blankTag(xml, "cp:lastModifiedBy");
    xml = xml.replace(/<cp:lastPrinted[^>]*>[\s\S]*?<\/cp:lastPrinted>/g, "");
    updateZipEntry(entries, "docProps/core.xml", xml);
  }

  const workbook = entries.find((entry) => entry.name === "xl/workbook.xml");
  if (workbook) {
    let xml = getZipEntryText(entries, "xl/workbook.xml");
    xml = xml
      .replace(/<mc:AlternateContent[\s\S]*?<\/mc:AlternateContent>/g, "")
      .replace(/<xr:revisionPtr[^>]*\/>/g, "");
    updateZipEntry(entries, "xl/workbook.xml", xml);
  }
}
