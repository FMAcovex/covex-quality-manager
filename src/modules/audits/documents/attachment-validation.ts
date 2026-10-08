import { readZip } from "@/lib/ooxml/zip";
import { hasPdfHeader } from "@/lib/qms/signed-version-document";

const mimeTypes = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`))?.[1];

export function validateAuditAttachment(name: string, mime: string, bytes: Uint8Array) {
  const ext = name.split(".").pop()?.toLowerCase() as keyof typeof mimeTypes;
  if (!Object.hasOwn(mimeTypes, ext) || !bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error("Solo se admiten PDF, DOCX o XLSX válidos de hasta 15 MB.");
  const expectedMime = mimeTypes[ext];
  // Browsers can leave MIME empty or use the generic binary type.
  if (mime && mime !== "application/octet-stream" && mime.toLowerCase() !== expectedMime) throw new Error("El MIME no corresponde a la extensión del adjunto.");
  if (ext === "pdf") {
    if (!hasPdfHeader(bytes)) throw new Error("Cabecera PDF no válida.");
  } else {
    try {
      const entries = readZip(Buffer.from(bytes), { maxExpandedBytes: 60 * 1024 * 1024, verifyIntegrity: true });
      const text = (part: string) => entries.find(e => e.name === part)?.data.toString("utf8") ?? "";
      const part = ext === "docx" ? "word/document.xml" : "xl/workbook.xml";
      const mainType = ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml";
      const types = text("[Content_Types].xml"), relationships = text("_rels/.rels"), main = text(part);
      const hasType = [...types.matchAll(/<(?:\w+:)?Override\b[^>]*>/g)].some(([tag]) => attribute(tag, "PartName") === `/${part}` && attribute(tag, "ContentType") === mainType);
      const hasRelationship = [...relationships.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)].some(([tag]) => attribute(tag, "Type")?.endsWith("/officeDocument") && attribute(tag, "Target")?.replace(/^\//, "") === part && attribute(tag, "TargetMode") !== "External");
      const root = ext === "docx" ? "document" : "workbook";
      const namespace = ext === "docx" ? "wordprocessingml" : "spreadsheetml";
      if (!hasType || !hasRelationship || !new RegExp(`<(?:\\w+:)?${root}\\b`).test(main) || !main.includes(`${namespace}/2006/main`)) throw new Error("Missing Office package parts.");
    } catch {
      throw new Error("El adjunto no contiene un paquete DOCX/XLSX válido para su extensión.");
    }
  }
  return expectedMime;
}
