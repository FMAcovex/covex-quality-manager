import { createHash } from "node:crypto";
import { sanitizeOfficeMetadata } from "../src/lib/ooxml/metadata";
import { extractWordBodyRange } from "../src/lib/ooxml/xml";
import {
  getZipEntryText,
  readZip,
  type ZipEntry,
  updateZipEntry,
  writeZip,
} from "../src/lib/ooxml/zip";

export type BundleSource =
  | {
      kind: "direct";
      aliases: string[];
      sha256: string;
    }
  | {
      kind: "word-range";
      aliases: string[];
      sha256: string;
      startMarker: string;
      endMarker?: string;
    };

export type BundleTemplateSpec = {
  relativePath: string;
  sources: BundleSource[];
};

export type ResolvedBundleTemplate = {
  data: Buffer;
  checksum: string;
  sourceName: string;
  derived: boolean;
};

export function sha256(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

function normalizedName(name: string) {
  return name.replaceAll("\\", "/");
}

function matchesAlias(entry: ZipEntry, alias: string) {
  return normalizedName(entry.name).endsWith(normalizedName(alias));
}

function findSingleEntry(entries: ZipEntry[], aliases: string[]) {
  const matches = entries.filter((entry) => aliases.some((alias) => matchesAlias(entry, alias)));
  const unique = [...new Map(matches.map((entry) => [entry.name, entry])).values()];
  if (unique.length > 1) {
    throw new Error(
      `Se encontraron varios archivos candidatos para: ${aliases.join(" | ")} -> ${unique.map((entry) => entry.name).join(", ")}`,
    );
  }
  return unique[0] ?? null;
}

function deriveWordRange(
  source: Buffer,
  startMarker: string,
  endMarker?: string,
) {
  const entries = readZip(source);
  let xml = getZipEntryText(entries, "word/document.xml");
  xml = extractWordBodyRange(xml, startMarker, endMarker, "last");
  updateZipEntry(entries, "word/document.xml", xml);
  sanitizeOfficeMetadata(entries);
  return writeZip(entries);
}

export function resolveBundleTemplate(
  spec: BundleTemplateSpec,
  entries: ZipEntry[],
): ResolvedBundleTemplate {
  const diagnostics: string[] = [];

  for (const source of spec.sources) {
    const entry = findSingleEntry(entries, source.aliases);
    if (!entry) {
      diagnostics.push(`no encontrado: ${source.aliases.join(" | ")}`);
      continue;
    }

    const actualSourceSha = sha256(entry.data);
    if (actualSourceSha !== source.sha256) {
      diagnostics.push(
        `${entry.name}: SHA-256 inesperado (esperado ${source.sha256}; recibido ${actualSourceSha})`,
      );
      continue;
    }

    const data =
      source.kind === "word-range"
        ? deriveWordRange(entry.data, source.startMarker, source.endMarker)
        : Buffer.from(entry.data);

    return {
      data,
      checksum: sha256(data),
      sourceName: entry.name,
      derived: source.kind === "word-range",
    };
  }

  throw new Error(
    `${spec.relativePath}: no se pudo resolver una fuente controlada. ${diagnostics.join(" · ")}`,
  );
}
