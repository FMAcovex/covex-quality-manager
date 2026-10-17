import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { deriveOosAnnex, oosAnnexRanges } from "../src/modules/oos/documents/derive";
import { oosPntV04EffectiveFrom, oosPntV04Sha, type OosAnnexType } from "../src/modules/oos/documents/templates";

// D-088, OOS-3: Anexos III, IV y VI derivados del PNT GC-10/014/04 verificado por SHA-256.
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

async function main() {
  const source = process.argv.slice(2).find((arg) => arg !== "--");
  if (!source) throw new Error("Uso: pnpm templates:oos:install -- <GC-10-014-04 (15-06-2025).docx>");
  const pnt = await readFile(source);
  if (sha256(pnt) !== oosPntV04Sha) throw new Error("El PNT no coincide con GC-10/014/04 corregido (SHA-256 inesperado).");
  const actor = process.env.DEFAULT_ACTOR_NAME || "Instalación técnica de plantillas";
  const assets = (Object.keys(oosAnnexRanges) as OosAnnexType[]).map((type) => {
    const data = deriveOosAnnex(pnt, type);
    return { type, data, checksum: sha256(data), fileName: oosAnnexRanges[type].fileName };
  });
  await prisma.$transaction(async (tx) => {
    for (const asset of assets) {
      const key = { module: QmsRecordType.OOS, documentType: DocumentType[asset.type], versionCode: "04" };
      const existing = await tx.templateVersion.findUnique({ where: { module_documentType_versionCode: key } });
      // A registered original is history: never replaced by a different binary.
      if (existing?.checksum && existing.checksum !== asset.checksum) throw new Error(`La versión 04 de ${asset.type} ya contiene otro binario: no se sustituye.`);
      const data = { fileName: asset.fileName, fileData: new Uint8Array(asset.data), fileSize: asset.data.length, checksum: asset.checksum, filePath: null, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
      const saved = existing
        ? await tx.templateVersion.update({ where: { id: existing.id }, data })
        : await tx.templateVersion.create({ data: { ...key, ...data, effectiveFrom: new Date(oosPntV04EffectiveFrom), isActive: true } });
      await tx.configurationChange.create({ data: {
        entityType: "TemplateVersion",
        entityKey: `OOS:${asset.type}:04`,
        action: existing ? "TEMPLATE_BINARY_VERIFIED" : "TEMPLATE_REGISTER",
        newValue: { fileName: saved.fileName, fileSize: saved.fileSize, checksum: saved.checksum, isActive: saved.isActive },
        changedByText: actor,
        reason: `Anexo derivado del PNT GC-10/014/04 verificado (SHA-256 ${oosPntV04Sha})`,
      } });
    }
  });
  for (const asset of assets) console.log(`OK OOS / ${asset.type} / v04 / ${asset.fileName} / ${asset.checksum}`);
}

if (process.argv[1]?.endsWith("install-oos-templates.ts")) {
  main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
}
