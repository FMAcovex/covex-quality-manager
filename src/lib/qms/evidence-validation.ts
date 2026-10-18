import { validateAuditAttachment } from "@/modules/audits/documents/attachment-validation";
import { MAX_EVIDENCE_SIZE } from "./evidence-constants";

export { MAX_EVIDENCE_SIZE };

const imageTypes = {
  png: { mime: "image/png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  jpg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
} as const;

/**
 * Comprueba extensión, MIME declarado y contenido real del archivo (cabecera PDF,
 * paquete DOCX/XLSX o firma PNG/JPEG). Devuelve el MIME que se conserva.
 * No sustituye a un antivirus: el análisis de malware sigue pendiente (docs/PNT_P2A.md).
 */
export function validateEvidenceFile(name: string, mime: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_EVIDENCE_SIZE) {
    throw new Error("La evidencia debe tener entre 1 byte y 15 MB.");
  }
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (Object.hasOwn(imageTypes, ext)) {
    const image = imageTypes[ext as keyof typeof imageTypes];
    if (mime && mime !== "application/octet-stream" && mime.toLowerCase() !== image.mime) {
      throw new Error("El MIME no corresponde a la extensión del adjunto.");
    }
    if (!image.magic.every((byte, index) => bytes[index] === byte)) {
      throw new Error("El contenido de la imagen no corresponde a su extensión.");
    }
    return image.mime;
  }
  try {
    return validateAuditAttachment(name, mime, bytes);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Solo se admiten")) {
      throw new Error("Solo se admiten PDF, DOCX, XLSX, PNG o JPG de hasta 15 MB.");
    }
    throw error;
  }
}
