import { DocumentType, PrismaClient, QmsRecordType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const department of [
    { code: "GC-00", name: "Garantía de Calidad" },
    { code: "PM-10", name: "Área de Producción de Medicamentos" },
    { code: "PA-20", name: "Área de Fabricación Química" },
  ]) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: { name: department.name, isActive: true },
      create: department,
    });
  }

  await prisma.formVersion.upsert({
    where: {
      module_versionCode: {
        module: QmsRecordType.DEVIATION,
        versionCode: "DEV-06",
      },
    },
    update: { isActive: true },
    create: {
      module: QmsRecordType.DEVIATION,
      versionCode: "DEV-06",
      effectiveFrom: new Date("2026-01-01"),
      isActive: true,
      notes: "Referencia de desarrollo; confirmar fecha controlada antes de producción.",
    },
  });

  await prisma.templateVersion.upsert({
    where: {
      module_documentType_versionCode: {
        module: QmsRecordType.DEVIATION,
        documentType: DocumentType.DEVIATION_ANNEX_III,
        versionCode: "06",
      },
    },
    update: { isActive: true },
    create: {
      module: QmsRecordType.DEVIATION,
      documentType: DocumentType.DEVIATION_ANNEX_III,
      versionCode: "06",
      effectiveFrom: new Date("2026-01-01"),
      isActive: true,
    },
  });

  await prisma.templateVersion.upsert({
    where: {
      module_documentType_versionCode: {
        module: QmsRecordType.DEVIATION,
        documentType: DocumentType.DEVIATION_ANNEX_V,
        versionCode: "06",
      },
    },
    update: { isActive: true },
    create: {
      module: QmsRecordType.DEVIATION,
      documentType: DocumentType.DEVIATION_ANNEX_V,
      versionCode: "06",
      effectiveFrom: new Date("2026-01-01"),
      isActive: true,
    },
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
