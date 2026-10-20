import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withDatabaseTransaction } from "@/lib/transaction-context";
import { templateCatalog, templateKey, type CatalogTemplate } from "@/modules/configuration/template-catalog";
import {
  decideInstall,
  resolveCatalogTemplates,
  sha256,
  templateMimeType,
  type InputFile,
} from "@/modules/configuration/template-install";
import { withBytes } from "@/lib/db-binary-omit";

// D-099/D-105: escritura de la instalación de plantillas. La comparten `pnpm templates:install`
// y el botón «Instalar plantillas» de Configuración → Versiones: mismas huellas, mismas reglas.

export type InstallLineStatus = "installed" | "unchanged" | "conflict" | "failed";

export type InstallLine = { status: InstallLineStatus; label: string; versionCode: string; message: string };

export type TemplateInstallReport = {
  lines: InstallLine[];
  /** Archivos cuya huella no está en el catálogo. */
  unrecognized: string[];
  /** Plantillas del catálogo sin archivo de origen en lo recibido. */
  missing: string[];
};

const json = (value: unknown) => value as Prisma.InputJsonValue;

export const installProblems = (report: TemplateInstallReport) =>
  report.lines.filter((line) => line.status === "conflict" || line.status === "failed").length;

/**
 * Instala en una sola transacción las plantillas del catálogo reconocidas entre `files`. Nunca
 * sustituye una versión instalada por otro binario; cada alta queda en el historial de
 * configuración y se comprueba, antes de confirmar, que lo guardado es lo verificado.
 */
export async function installTemplateFiles(
  files: InputFile[],
  options: { actor: string; origin: string; catalog?: CatalogTemplate[] },
): Promise<TemplateInstallReport> {
  const { resolved, missing, unrecognized, failed } = resolveCatalogTemplates(files, options.catalog ?? templateCatalog);
  const lines: InstallLine[] = failed.map(({ entry, error }) => ({ status: "failed", label: entry.label, versionCode: entry.versionCode, message: `no se ha podido preparar: ${error}` }));

  await withDatabaseTransaction(prisma, async (tx) => {
    for (const { entry, data, checksum, sourceName, derived } of resolved) {
      const key = { module: entry.module, documentType: entry.documentType, versionCode: entry.versionCode };
      const line = (status: InstallLineStatus, message: string) => lines.push({ status, label: entry.label, versionCode: entry.versionCode, message });
      const existing = await tx.templateVersion.findUnique({ where: { module_documentType_versionCode: key }, omit: withBytes });
      const otherActive = await tx.templateVersion.count({ where: { module: entry.module, documentType: entry.documentType, isActive: true, NOT: { versionCode: entry.versionCode } } });
      const decision = decideInstall(entry, checksum, existing ? { checksum: existing.checksum, hasBinary: Boolean(existing.fileData || existing.filePath) } : null, otherActive > 0);
      if (decision.action === "unchanged") {
        line("unchanged", "ya instalada");
        continue;
      }
      if (decision.action === "conflict") {
        line("conflict", decision.reason);
        continue;
      }
      const binary = { fileName: entry.fileName, mimeType: templateMimeType(entry.fileName), fileData: new Uint8Array(data), fileSize: data.length, checksum, filePath: null };
      const saved = decision.action === "create"
        ? await tx.templateVersion.create({ data: { ...key, ...binary, effectiveFrom: new Date(entry.effectiveFrom), isActive: decision.isActive } })
        : await tx.templateVersion.update({ where: { id: existing!.id }, data: binary });
      // Lo guardado coincide con lo verificado; si no, no se confirma nada.
      const stored = await tx.templateVersion.findUnique({ where: { id: saved.id }, select: { fileData: true, checksum: true } });
      if (!stored?.fileData || stored.checksum !== checksum || sha256(stored.fileData) !== checksum) throw new Error(`${entry.label}: fallo de integridad después de guardar.`);
      await tx.configurationChange.create({
        data: {
          entityType: "TemplateVersion",
          entityKey: templateKey(entry),
          action: decision.action === "create" ? "TEMPLATE_REGISTER" : decision.action === "fill" ? "TEMPLATE_BINARY_INSTALLED" : "TEMPLATE_REDERIVED",
          oldValue: existing ? json({ fileName: existing.fileName, fileSize: existing.fileSize, checksum: existing.checksum, isActive: existing.isActive }) : undefined,
          newValue: json({ fileName: saved.fileName, fileSize: saved.fileSize, checksum: saved.checksum, isActive: saved.isActive }),
          changedByText: options.actor,
          reason: `Instalación de plantilla controlada reconocida por SHA-256 (${options.origin}) · origen ${sourceName}${derived ? " (anexo derivado del original verificado)" : ""}`,
        },
      });
      line("installed", decision.action === "create"
        ? `instalada${saved.isActive ? "" : " (inactiva: actívala en Configuración → Versiones)"}`
        : decision.action === "fill" ? "instalada" : entry.replacesDocConversion ? "sustituida la conversión anterior del .doc" : "sustituida la derivación anterior del mismo PNT");
    }
  });

  return {
    lines,
    unrecognized,
    missing: missing.map((item) => `${item.label} · versión ${item.versionCode}`),
  };
}
