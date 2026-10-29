/**
 * Vista previa en el navegador (D-121): PDF e imágenes se pueden abrir sin descargarlos con
 * `?preview=1` en su misma ruta de descarga (mismos permisos y comprobaciones). Word, Excel y
 * cualquier otro tipo se descargan siempre.
 */
export const PREVIEW_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export function canPreview(mimeType: string | null | undefined) {
  return (PREVIEW_MIME_TYPES as readonly string[]).includes((mimeType ?? "").toLowerCase());
}

/**
 * Tipo para decidir si se ofrece «Ver» cuando la página no carga el tipo guardado (p. ej., en una
 * versión congelada). Solo afecta al botón: la ruta decide con el tipo guardado del archivo.
 */
export function previewTypeFromName(fileName: string | null | undefined) {
  const extension = (fileName ?? "").toLowerCase().split(".").pop();
  return extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : null;
}

export function previewHref(href: string) {
  return href + (href.includes("?") ? "&" : "?") + "preview=1";
}

/** Cabecera Content-Disposition: `inline` solo si se pide la vista previa y el tipo lo admite. */
export function contentDisposition(request: Request, fileName: string, mimeType: string | null | undefined) {
  const inline = new URL(request.url).searchParams.get("preview") === "1" && canPreview(mimeType);
  return `${inline ? "inline" : "attachment"}; filename="${fileName}"`;
}
