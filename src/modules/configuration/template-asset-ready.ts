import type { Prisma } from "@prisma/client";

/** Una versión de plantilla tiene su archivo instalado (nombre o ruta) y su huella SHA-256 registrada. */
export function templateAssetReady(template: {
  fileName?: string | null;
  filePath?: string | null;
  checksum?: string | null;
} | null | undefined) {
  return Boolean((template?.fileName || template?.filePath) && template?.checksum);
}

/**
 * Filtro de «plantilla instalada» con el criterio del cargador (`loadStoredTemplateAsset`) y del instalador:
 * archivo guardado o ruta, y huella registrada. Sirve para comprobarlo sin leer los bytes (D-112).
 */
export const installedTemplateWhere = (id: string): Prisma.TemplateVersionWhereInput =>
  ({ id, checksum: { not: null }, OR: [{ fileData: { not: null } }, { filePath: { not: null } }] });
