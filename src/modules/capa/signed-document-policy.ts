export function capaSignedPdfUploadError(status: string) {
  if (status === "DRAFT") {
    return "No se puede cargar un PDF firmado mientras la CAPA está en Borrador.";
  }
  return null;
}
