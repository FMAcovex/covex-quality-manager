import { readFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/db";
import { readZip, writeZip } from "../src/lib/ooxml/zip";
import { sanitizeOfficeMetadata } from "../src/lib/ooxml/metadata";
import { programmeDocumentTypes } from "../src/modules/audits/annual-programme/domain";
const sources = [
  { type: "INTERNAL" as const, name: "Plantilla Anexo PMAI[V04[01-2023.doc", hash: "fa1296da0c6bbb9561e2ab992e717b7b2e31f73cc70ce274bac0a79a3b457e36", version: "PMAI-V04-01-2023-GENERAL", date: "2023-01-01" },
  { type: "EXTERNAL" as const, name: "PLAN MAESTRO A. EXTERNAS V05.docx", hash: "e55c7b2623604c45aa7282c6601479189a56395cbfa05fc421742a7e9db98cda", version: "PMAE-V05-06-2026-ANEXO-I", date: "2026-06-01" },
];
const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
async function main() {
  const dir = process.argv[2];
  if (!dir) throw Error("Indica la carpeta con los dos originales vigentes. No se utilizan programas cumplimentados ni el antiguo Anexo II.");
  // Verify both originals before conversion or writes. Original files remain read-only.
  const originals = await Promise.all(sources.map(async source => {
    const bytes = await readFile(path.resolve(dir, source.name));
    if (digest(bytes) !== source.hash) throw Error(`SHA-256 no reconocido: ${source.name}. Revisar la fuente antes de adaptar el generador.`);
    return { source, bytes };
  }));
  const scratch = await mkdtemp(path.join(tmpdir(), "covex-annual-programmes-"));
  try {
    const assets: { source: typeof sources[number]; prepared: Buffer }[] = [];
    for (const { source, bytes } of originals) {
      let prepared: Buffer = bytes;
      if (source.type === "INTERNAL") {
        // The official general template is legacy .doc; convert a disposable copy.
        const copy = path.join(scratch, "internal-template.doc");
        await writeFile(copy, bytes);
        execFileSync(process.env.LIBREOFFICE_BIN || "soffice", [`-env:UserInstallation=file://${scratch}/profile`, "--headless", "--convert-to", "docx", "--outdir", scratch, copy], { timeout: 120000, stdio: "pipe" });
        const converted = (await readdir(scratch)).find(n => n === "internal-template.docx");
        if (!converted) throw Error("LibreOffice no ha producido la plantilla editable.");
        prepared = await readFile(path.join(scratch, converted));
      }
      const entries = readZip(prepared, { maxExpandedBytes: 40 * 1024 * 1024, verifyIntegrity: true });
      sanitizeOfficeMetadata(entries); prepared = writeZip(entries);
      assets.push({ source, prepared });
    }
    await prisma.$transaction(async tx => {
      for (const { source, prepared } of assets) {
        const key = { module: "AUDIT" as const, documentType: programmeDocumentTypes[source.type], versionCode: source.version };
        const existing = await tx.templateVersion.findUnique({ where: { module_documentType_versionCode: key } });
        // Conversion metadata may vary between LibreOffice installations. Never replace an installed template.
        if (existing) {
          if (!existing.fileData || digest(Buffer.from(existing.fileData)) !== existing.checksum) throw Error(`Plantilla instalada sin integridad: ${source.version}`);
          continue;
        }
        await tx.templateVersion.create({ data: { ...key, effectiveFrom: new Date(source.date), fileName: `${source.version}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileData: new Uint8Array(prepared), fileSize: prepared.length, checksum: digest(prepared), isActive: true } });
      }
    });
    console.log("Plantillas de programas anuales verificadas/instaladas. Fuentes SHA-256 fijadas; Word convertido registrado sin sustituir históricos. Revisar visualmente la conversión interna antes del uso operativo.");
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
main().finally(() => prisma.$disconnect()).catch(e => { console.error(e); process.exitCode = 1; });
