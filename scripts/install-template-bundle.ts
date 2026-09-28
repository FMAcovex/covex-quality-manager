import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType, Prisma, PrismaClient, QmsRecordType } from "@prisma/client";
import { readZip } from "../src/lib/ooxml/zip";

const prisma = new PrismaClient();

type BundleTemplate = {
  module: QmsRecordType;
  documentType: DocumentType;
  versionCode: string;
  relativePath: string;
  sha256: string;
  effectiveFrom: string;
};

const templates: BundleTemplate[] = [
  {
    module: QmsRecordType.DEVIATION,
    documentType: DocumentType.DEVIATION_ANNEX_III,
    versionCode: "06",
    relativePath: "templates/deviations/v06/Anexo III Informe Desviaciones 06.docx",
    sha256: "8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43",
    effectiveFrom: "2026-03-12",
  },
  {
    module: QmsRecordType.DEVIATION,
    documentType: DocumentType.DEVIATION_ANNEX_V,
    versionCode: "06",
    relativePath: "templates/deviations/v06/Anexo V.xlsx",
    sha256: "1f92410bc94e2037fe632450ce766b3ce5d44c4f55b8868056bad73c882c03f2",
    effectiveFrom: "2026-03-12",
  },
  {
    module: QmsRecordType.CAPA,
    documentType: DocumentType.CAPA_ANNEX_III,
    versionCode: "05",
    relativePath: "templates/capa/v05/Anexo III INFORME CAPA 05.docx",
    sha256: "73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540",
    effectiveFrom: "2026-03-11",
  },
  {
    module: QmsRecordType.CAPA,
    documentType: DocumentType.CAPA_ANNEX_IV,
    versionCode: "05",
    relativePath: "templates/capa/v05/Anexo IV LISTADO CAPA 05 oficial.xlsx",
    sha256: "47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3",
    effectiveFrom: "2026-03-11",
  },
  {
    module: QmsRecordType.CHANGE_CONTROL,
    documentType: DocumentType.CHANGE_ANNEX_III,
    versionCode: "03",
    relativePath: "templates/change-control/v03/Anexo III Solicitud GC-00-003-03.docx",
    sha256: "a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f",
    effectiveFrom: "2026-05-05",
  },
  {
    module: QmsRecordType.CHANGE_CONTROL,
    documentType: DocumentType.CHANGE_ANNEX_IV,
    versionCode: "03",
    relativePath: "templates/change-control/v03/Anexo IV Dictamen GC-00-003-03.docx",
    sha256: "742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60",
    effectiveFrom: "2026-05-05",
  },
  {
    module: QmsRecordType.CHANGE_CONTROL,
    documentType: DocumentType.CHANGE_ANNEX_V,
    versionCode: "03",
    relativePath: "templates/change-control/v03/Anexo V Seguimiento GC-00-003-03.docx",
    sha256: "3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4",
    effectiveFrom: "2026-05-05",
  },
  {
    module: QmsRecordType.CHANGE_CONTROL,
    documentType: DocumentType.CHANGE_ANNEX_VII,
    versionCode: "03",
    relativePath: "templates/change-control/v03/Anexo VII_PNT GC003.03_Listado seguimiento .xlsx",
    sha256: "b65671cdd652f104f4038c65e07c025b5c7374dee4b683d74fbeef55f12bc8eb",
    effectiveFrom: "2026-05-05",
  },
  {
    module: QmsRecordType.COMPLAINT,
    documentType: DocumentType.COMPLAINT_ANNEX_III,
    versionCode: "03",
    relativePath: "templates/complaints/v03/Anexo III Informe Reclamacion 03.docx",
    sha256: "764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde",
    effectiveFrom: "2026-09-28",
  },
  {
    module: QmsRecordType.COMPLAINT,
    documentType: DocumentType.COMPLAINT_ANNEX_V,
    versionCode: "03",
    relativePath: "templates/complaints/v03/Anexo V Listado Reclamaciones 03.xlsx",
    sha256: "8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83",
    effectiveFrom: "2026-09-28",
  },
  {
    module: QmsRecordType.RETURN,
    documentType: DocumentType.RETURN_ANNEX_III,
    versionCode: "03",
    relativePath: "templates/returns/v03/Anexo III Formulario Devolucion 03.docx",
    sha256: "9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4",
    effectiveFrom: "2026-05-26",
  },
  {
    module: QmsRecordType.RETURN,
    documentType: DocumentType.RETURN_ANNEX_IV,
    versionCode: "03",
    relativePath: "templates/returns/v03/Anexo IV Hoja Devolucion Producto 03.docx",
    sha256: "711a3cb833bd14d7aa6ddf5b2655b6e7bbc084c8331958db415feebfe69a1317",
    effectiveFrom: "2026-05-26",
  },
  {
    module: QmsRecordType.RETURN,
    documentType: DocumentType.RETURN_ANNEX_V,
    versionCode: "03",
    relativePath: "templates/returns/v03/Anexo V Declaracion Cliente Conservacion 03.docx",
    sha256: "818a01a3a61cbf29546f70d99b67c2679888bfa77785ded39a17eefe624bcafd",
    effectiveFrom: "2026-05-26",
  },
  {
    module: QmsRecordType.RETURN,
    documentType: DocumentType.RETURN_ANNEX_VI,
    versionCode: "03",
    relativePath: "templates/returns/v03/Anexo VI Listado Devoluciones 03.xlsx",
    sha256: "fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64",
    effectiveFrom: "2026-05-26",
  },
];

function sha256(data: Buffer) {
  return createHash("sha256").update(data).digest("hex");
}

function mimeType(fileName: string) {
  return fileName.toLowerCase().endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function main() {
  const bundlePath = process.argv[2];
  if (!bundlePath) {
    throw new Error("Uso: pnpm templates:bundle:install -- <COVEX_APP_PLANTILLAS_2A.zip>");
  }

  const actor = process.env.DEFAULT_ACTOR_NAME || "Instalación técnica de plantillas";
  const bundle = await readFile(bundlePath);
  const entries = readZip(bundle).filter((entry) => !entry.name.endsWith("/"));

  const resolved = templates.map((spec) => {
    const matches = entries.filter((entry) =>
      entry.name.replaceAll("\\", "/").endsWith(spec.relativePath),
    );
    if (matches.length !== 1) {
      throw new Error(
        `${spec.relativePath}: se esperaba exactamente un archivo en el bundle y se encontraron ${matches.length}.`,
      );
    }
    const entry = matches[0];
    const actualSha = sha256(entry.data);
    if (actualSha !== spec.sha256) {
      throw new Error(
        `${spec.relativePath}: SHA-256 no válido. Esperado ${spec.sha256}; recibido ${actualSha}.`,
      );
    }
    return { spec, entry };
  });

  console.log(`Bundle verificado: ${resolved.length} plantillas con SHA-256 correcto.`);

  await prisma.$transaction(async (tx) => {
    for (const { spec, entry } of resolved) {
      const key = {
        module: spec.module,
        documentType: spec.documentType,
        versionCode: spec.versionCode,
      };
      const existing = await tx.templateVersion.findUnique({
        where: { module_documentType_versionCode: key },
      });
      const metadata = {
        fileName: path.basename(spec.relativePath),
        mimeType: mimeType(spec.relativePath),
        fileData: new Uint8Array(entry.data),
        fileSize: entry.data.length,
        checksum: spec.sha256,
        filePath: null,
      };

      const saved = existing
        ? await tx.templateVersion.update({ where: { id: existing.id }, data: metadata })
        : await tx.templateVersion.create({
            data: {
              ...key,
              ...metadata,
              effectiveFrom: new Date(spec.effectiveFrom),
              isActive: false,
            },
          });

      await tx.configurationChange.create({
        data: {
          entityType: "TemplateVersion",
          entityKey: `${spec.module}:${spec.documentType}:${spec.versionCode}`,
          action: existing ? "BULK_TEMPLATE_BINARY_UPDATE" : "BULK_TEMPLATE_REGISTER",
          oldValue: existing
            ? json({
                fileName: existing.fileName,
                fileSize: existing.fileSize,
                checksum: existing.checksum,
                isActive: existing.isActive,
              })
            : undefined,
          newValue: json({
            fileName: saved.fileName,
            fileSize: saved.fileSize,
            checksum: saved.checksum,
            isActive: saved.isActive,
          }),
          changedByText: actor,
          reason: "Carga controlada del bundle oficial de plantillas Hito 10.3",
        },
      });
    }
  });

  const stored = await prisma.templateVersion.findMany({
    where: {
      OR: templates.map((spec) => ({
        module: spec.module,
        documentType: spec.documentType,
        versionCode: spec.versionCode,
      })),
    },
    select: {
      module: true,
      documentType: true,
      versionCode: true,
      fileName: true,
      fileData: true,
      fileSize: true,
      checksum: true,
      isActive: true,
    },
  });

  if (stored.length !== templates.length) {
    throw new Error(
      `Verificación posterior incompleta: se esperaban ${templates.length} plantillas y hay ${stored.length}.`,
    );
  }

  for (const spec of templates) {
    const row = stored.find(
      (item) =>
        item.module === spec.module &&
        item.documentType === spec.documentType &&
        item.versionCode === spec.versionCode,
    );
    if (!row?.fileData) {
      throw new Error(`${spec.module}/${spec.documentType}/${spec.versionCode}: binario no almacenado.`);
    }
    const actualSha = sha256(Buffer.from(row.fileData));
    if (
      actualSha !== spec.sha256 ||
      row.checksum !== spec.sha256 ||
      row.fileSize !== row.fileData.length
    ) {
      throw new Error(
        `${spec.module}/${spec.documentType}/${spec.versionCode}: fallo de integridad después de guardar.`,
      );
    }
  }

  console.log("Verificación PostgreSQL correcta.");
  for (const row of stored.sort((a, b) =>
    `${a.module}:${a.documentType}`.localeCompare(`${b.module}:${b.documentType}`),
  )) {
    console.log(
      `OK ${row.module} / ${row.documentType} / v${row.versionCode} / ${row.fileName} / ${row.isActive ? "ACTIVA" : "NO ACTIVA"}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
