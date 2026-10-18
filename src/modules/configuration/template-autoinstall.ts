import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { auditPolicyState } from "@/lib/audit/activation";
import type { CatalogTemplate } from "@/modules/configuration/template-catalog";
import { collectTemplateFiles } from "@/modules/configuration/template-install";
import { installProblems, installTemplateFiles, type TemplateInstallReport } from "@/modules/configuration/template-install-service";

// D-107: instalación automática al arrancar desde la carpeta de plantillas del servidor
// (TEMPLATE_INSTALL_DIR). Las plantillas no van en Git: IT las deja en esa carpeta y la aplicación
// las instala con el mismo servicio que la terminal y el botón de Configuración.

export type AutoInstallResult =
  | { status: "skipped"; reason: "no-directory" | "empty" | "audit-required" }
  | { status: "done"; report: TemplateInstallReport };

export const autoInstallActor = "Instalación automática al arrancar";

/** Lo instalado sigue intacto: una versión ya instalada se queda como está y repetir no escribe nada. */
export async function installTemplatesFromDirectory(directory: string, options: { catalog?: CatalogTemplate[] } = {}): Promise<AutoInstallResult> {
  const root = path.resolve(directory);
  if (!existsSync(root)) return { status: "skipped", reason: "no-directory" };
  const files = collectTemplateFiles(root);
  if (!files.length) return { status: "skipped", reason: "empty" };
  // Con el audit trail obligatorio, cada cambio necesita un usuario autenticado: se usa el botón.
  if ((await auditPolicyState(prisma)).required) return { status: "skipped", reason: "audit-required" };
  const report = await installTemplateFiles(files, { actor: autoInstallActor, origin: "carpeta de plantillas del servidor", catalog: options.catalog });
  return { status: "done", report };
}

export function autoInstallSummary(result: AutoInstallResult) {
  if (result.status === "skipped") {
    return {
      "no-directory": "Plantillas: la carpeta indicada en TEMPLATE_INSTALL_DIR no existe; no se instala nada.",
      empty: "Plantillas: la carpeta de plantillas no tiene archivos .zip, .docx ni .xlsx.",
      "audit-required": "Plantillas: con el audit trail obligatorio no se instalan al arrancar; usa Configuración → Versiones → «Instalar plantillas».",
    }[result.reason];
  }
  const count = (status: string) => result.report.lines.filter((line) => line.status === status).length;
  return `Plantillas: ${count("installed")} instaladas, ${count("unchanged")} ya estaban, ${installProblems(result.report)} con problemas, ${result.report.unrecognized.length} archivos no reconocidos.`;
}
