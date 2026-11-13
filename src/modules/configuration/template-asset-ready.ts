/** Una versión de plantilla tiene su archivo instalado (nombre o ruta) y su huella SHA-256 registrada. */
export function templateAssetReady(template: {
  fileName?: string | null;
  filePath?: string | null;
  checksum?: string | null;
} | null | undefined) {
  return Boolean((template?.fileName || template?.filePath) && template?.checksum);
}
