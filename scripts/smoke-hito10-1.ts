import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deviation = await prisma.qmsRecord.findFirstOrThrow({
    where: { recordType: "DEVIATION", businessCode: "DEMO-DES-001-2026" },
  });
  const capa = await prisma.qmsRecord.findFirstOrThrow({
    where: { recordType: "CAPA", businessCode: "DEMO-CAPA-001-2026" },
  });
  const complaint = await prisma.qmsRecord.findFirstOrThrow({
    where: { recordType: "COMPLAINT", businessCode: "DEMO-REC-001-2026" },
  });

  const autoRelation = await prisma.qmsRelation.findUnique({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: deviation.id,
        targetRecordId: capa.id,
        relationType: "GENERATES",
      },
    },
  });
  assert.ok(autoRelation?.isActive, "La relación demo Desviación → CAPA debe estar activa.");

  const testRelation = await prisma.qmsRelation.upsert({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: deviation.id,
        targetRecordId: complaint.id,
        relationType: "ASSOCIATED_WITH",
      },
    },
    update: { isActive: true, createdByText: "CI Hito 10.1" },
    create: {
      sourceRecordId: deviation.id,
      targetRecordId: complaint.id,
      relationType: "ASSOCIATED_WITH",
      createdByText: "CI Hito 10.1",
    },
  });

  try {
    const [fromDeviation, fromComplaint] = await Promise.all([
      prisma.qmsRecord.findUniqueOrThrow({
        where: { id: deviation.id },
        include: {
          sourceRelations: {
            where: { isActive: true },
            include: { targetRecord: true },
          },
          targetRelations: {
            where: { isActive: true },
            include: { sourceRecord: true },
          },
        },
      }),
      prisma.qmsRecord.findUniqueOrThrow({
        where: { id: complaint.id },
        include: {
          sourceRelations: {
            where: { isActive: true },
            include: { targetRecord: true },
          },
          targetRelations: {
            where: { isActive: true },
            include: { sourceRecord: true },
          },
        },
      }),
    ]);

    assert.ok(
      fromDeviation.sourceRelations.some((relation) => relation.targetRecord.id === complaint.id),
      "La relación debe ser visible desde el expediente origen.",
    );
    assert.ok(
      fromComplaint.targetRelations.some((relation) => relation.sourceRecord.id === deviation.id),
      "La misma relación debe ser visible desde el expediente destino.",
    );

    const expectedTemplates = [
      ["DEVIATION", "DEVIATION_ANNEX_III", "06"],
      ["DEVIATION", "DEVIATION_ANNEX_V", "06"],
      ["CAPA", "CAPA_ANNEX_III", "05"],
      ["CAPA", "CAPA_ANNEX_IV", "05"],
      ["CHANGE_CONTROL", "CHANGE_ANNEX_III", "03"],
      ["CHANGE_CONTROL", "CHANGE_ANNEX_IV", "03"],
      ["CHANGE_CONTROL", "CHANGE_ANNEX_V", "03"],
      ["CHANGE_CONTROL", "CHANGE_ANNEX_VII", "03"],
      ["COMPLAINT", "COMPLAINT_ANNEX_III", "02"],
      ["COMPLAINT", "COMPLAINT_ANNEX_IV", "02"],
      ["COMPLAINT", "COMPLAINT_ANNEX_V", "02"],
      ["RETURN", "RETURN_ANNEX_III", "03"],
      ["RETURN", "RETURN_ANNEX_IV", "03"],
      ["RETURN", "RETURN_ANNEX_V", "03"],
      ["RETURN", "RETURN_ANNEX_VI", "03"],
    ] as const;

    for (const [module, documentType, versionCode] of expectedTemplates) {
      const template = await prisma.templateVersion.findUnique({
        where: {
          module_documentType_versionCode: {
            module,
            documentType,
            versionCode,
          },
        },
      });
      assert.ok(template?.isActive, `Falta plantilla configurada ${module}/${documentType}/${versionCode}`);
    }

    console.log("Hito 10.1 smoke OK");
    console.log("Relaciones bidireccionales visibles y 15 familias documentales configuradas.");
  } finally {
    await prisma.qmsRelation.delete({ where: { id: testRelation.id } });
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
