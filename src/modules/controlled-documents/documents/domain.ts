import { validateAuditAttachment } from "@/modules/audits/documents/attachment-validation";
import { documentKinds, DocumentKind } from "./types";
export const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;
export function uuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error("Identificador documental no válido.");
  return value;
}
export function kind(value: string): DocumentKind {
  if (!Object.hasOwn(documentKinds, value)) throw new Error("Tipo documental no válido.");
  return value as DocumentKind;
}
export function originalName(value: string) {
  if (!value.trim() || value.length > 200 || /[\\/\x00-\x1f\x7f]/.test(value) || value === "." || value === "..") throw new Error("Nombre de archivo no válido; no se permiten rutas.");
  return value;
}
export function externalReference(value: string) {
  if (value.length > 2000) throw new Error("Referencia externa demasiado larga.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("La referencia debe ser una URL HTTPS."); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("La referencia debe ser HTTPS y no contener credenciales.");
  return url.href;
}
export function validateDocumentFile(name: string, mime: string, bytes: Uint8Array, type: DocumentKind) {
  originalName(name);
  const ext = name.split(".").pop()?.toLowerCase();
  if (type === "WORKING_WORD" && ext !== "docx") throw new Error("El documento de elaboración debe ser DOCX.");
  if (["DOCUMENT_PDF", "EXTERNAL_SIGNED_PDF"].includes(type) && ext !== "pdf") throw new Error("Este tipo documental requiere PDF.");
  return validateAuditAttachment(name, mime, bytes);
}
