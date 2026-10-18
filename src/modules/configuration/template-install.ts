import { createHash } from "node:crypto";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { extractWordBodyRange } from "@/lib/ooxml/xml";
import { getZipEntryText, readZip, updateZipEntry, writeZip } from "@/lib/ooxml/zip";
import { deriveOosAnnex } from "@/modules/oos/documents/derive";
import type { OosAnnexType } from "@/modules/oos/documents/templates";
import { templateCatalog, type CatalogTemplate, type TemplateSource } from "@/modules/configuration/template-catalog";

// D-099: instalación de plantillas reconociendo cada archivo por su huella. Lógica sin
// base de datos; `template-install-service.ts` la aplica dentro de una transacción, tanto
// desde `pnpm templates:install` como desde Configuración → Versiones (D-105).

export const sha256 = (data: Buffer | Uint8Array) => createHash("sha256").update(data).digest("hex");

export type InputFile = { name: string; data: Buffer };

const officeFile = /\.(docx|xlsx)$/i;

/**
 * Archivos de Office de una entrada: el propio archivo, o los que contiene un ZIP. Solo se leen;
 * nada de lo que traiga el paquete se ejecuta. El resto de archivos se ignora.
 */
export function expandTemplateInput(name: string, data: Buffer, maxExpandedBytes = 512 * 1024 * 1024): InputFile[] {
  if (/\.zip$/i.test(name)) {
    return readZip(data, { maxExpandedBytes })
      .filter((entry) => !entry.name.endsWith("/") && !entry.name.startsWith("__MACOSX/") && officeFile.test(entry.name))
      .map((entry) => ({ name: `${name} › ${entry.name}`, data: entry.data }));
  }
  return officeFile.test(name) ? [{ name, data }] : [];
}

export type ResolvedTemplate = {
  entry: CatalogTemplate;
  data: Buffer;
  checksum: string;
  sourceName: string;
  derived: boolean;
};

function normalizeOffice(data: Buffer) {
  const entries = readZip(data, { maxExpandedBytes: 40 * 1024 * 1024, verifyIntegrity: true });
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}

export function deriveTemplate(entry: CatalogTemplate, source: TemplateSource, data: Buffer) {
  switch (source.kind) {
    case "file":
      return data;
    case "pnt-range": {
      const entries = readZip(data);
      const xml = extractWordBodyRange(getZipEntryText(entries, "word/document.xml"), source.start, source.end, "last");
      updateZipEntry(entries, "word/document.xml", xml);
      sanitizeOfficeMetadata(entries);
      return writeZip(entries);
    }
    case "oos-pnt":
      return deriveOosAnnex(data, entry.documentType as OosAnnexType);
    case "office-normalized":
      return normalizeOffice(data);
  }
}

/**
 * Reconoce los archivos por su SHA-256 y prepara cada plantilla del catálogo que tenga
 * origen entre ellos. Los nombres de archivo no intervienen.
 */
export function resolveCatalogTemplates(files: InputFile[], catalog = templateCatalog) {
  const byHash = new Map<string, InputFile>();
  for (const file of files) {
    const hash = sha256(file.data);
    if (!byHash.has(hash)) byHash.set(hash, file);
  }
  const known = new Set(catalog.flatMap((item) => item.sources.map((source) => source.sha256)));
  const resolved: ResolvedTemplate[] = [];
  const missing: CatalogTemplate[] = [];
  const failed: { entry: CatalogTemplate; error: string }[] = [];
  for (const entry of catalog) {
    const source = entry.sources.find((item) => byHash.has(item.sha256));
    if (!source) {
      missing.push(entry);
      continue;
    }
    const input = byHash.get(source.sha256)!;
    try {
      const data = deriveTemplate(entry, source, input.data);
      resolved.push({ entry, data, checksum: sha256(data), sourceName: input.name, derived: source.kind !== "file" });
    } catch (error) {
      // Un anexo que no se puede preparar no impide instalar los demás.
      failed.push({ entry, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const unrecognized = [...byHash.entries()].filter(([hash]) => !known.has(hash)).map(([, file]) => file.name);
  return { resolved, missing, unrecognized, failed };
}

export type InstalledTemplate = { checksum: string | null; hasBinary: boolean };

export type InstallDecision =
  | { action: "create"; isActive: boolean }
  | { action: "fill" }
  | { action: "replace-superseded" }
  | { action: "unchanged" }
  | { action: "conflict"; reason: string };

/**
 * Una versión instalada no se sustituye por otro binario. Solo se completa una versión
 * registrada sin archivo (catálogo inicial) o se sustituye una derivación anterior
 * documentada del mismo origen. Una versión nueva queda activa si no hay otra activa.
 */
export function decideInstall(
  entry: CatalogTemplate,
  checksum: string,
  existing: InstalledTemplate | null,
  otherActiveVersion: boolean,
): InstallDecision {
  if (!existing) return { action: "create", isActive: !otherActiveVersion };
  if (!existing.hasBinary) return { action: "fill" };
  if (existing.checksum === checksum) return { action: "unchanged" };
  if (entry.replacesDocConversion || (existing.checksum && entry.supersededChecksums?.includes(existing.checksum))) return { action: "replace-superseded" };
  return {
    action: "conflict",
    reason: `ya tiene instalado otro archivo (SHA-256 ${existing.checksum?.slice(0, 12) ?? "desconocido"}…); no se sustituye. Una revisión nueva se registra como versión nueva en Configuración → Versiones.`,
  };
}

export function templateMimeType(fileName: string) {
  return fileName.toLowerCase().endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
