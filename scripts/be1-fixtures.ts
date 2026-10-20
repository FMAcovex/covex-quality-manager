import { randomUUID } from "node:crypto";
import { Prisma, type DocumentType, type QmsRecordType } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { createPhase3b2Fixtures } from "./phase3b2-fixtures";
import { purgeLegacyFixtureDocuments } from "./audit-fixtures/legacy-cleanup";

export type Be1Fixture = Awaited<ReturnType<typeof createPhase3b2Fixtures>> & {
  oosIds: string[];
  binaryDetail: { deviation: string; capa: string; change: string; audit: string; oos: string };
};

const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Cohorte de 3B2 (el tamaño es el total de expedientes QMS repartidos entre los seis módulos) más OOS en la misma
 * proporción y ficheros reales de 1 MiB en una ficha de Desviación, CAPA, Cambios, Auditoría y OOS. Las plantillas
 * activas ficticias hacen que los formularios de alta tengan bytes que leer.
 */
export async function createBe1Fixtures(size: number): Promise<Be1Fixture> {
  const base = await createPhase3b2Fixtures(size, false, true);
  const { prefix, departments, ids, bytes, checksum } = base;
  const actor = "Actor sintético BE1";
  const oosIds: string[] = [], oosQmsIds: string[] = [], templateIds: string[] = [];
  // Las versiones y documentos de los expedientes 3B2 los borra su propio cleanup; aquí solo lo añadido.
  const removeAll = async () => {
    await prisma.generatedDocument.deleteMany({ where: { templateVersionId: { in: templateIds } } });
    if (oosQmsIds.length) await purgeLegacyFixtureDocuments(prisma, { recordVersion: { qmsRecordId: { in: oosQmsIds } } });
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: oosQmsIds } } });
    await prisma.oosRecord.deleteMany({ where: { id: { in: oosIds } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: oosQmsIds } } });
    await prisma.deviation.updateMany({ where: { anexoIIITemplateVersionId: { in: templateIds } }, data: { anexoIIITemplateVersionId: null } });
    await prisma.capa.updateMany({ where: { annexIIITemplateVersionId: { in: templateIds } }, data: { annexIIITemplateVersionId: null } });
    await prisma.changeControl.updateMany({ where: { annexIIITemplateVersionId: { in: templateIds } }, data: { annexIIITemplateVersionId: null } });
    await base.cleanup();
    await prisma.templateVersion.deleteMany({ where: { id: { in: templateIds } } });
  };
  try {
    const qms: Prisma.QmsRecordCreateManyInput[] = [], oos: Prisma.OosRecordCreateManyInput[] = [];
    for (let i = 0; i < Math.max(1, Math.floor(size / 6)); i++) {
      const id = randomUUID(), qmsRecordId = randomUUID(), year = 2022 + i % 5;
      oosIds.push(id); oosQmsIds.push(qmsRecordId);
      qms.push({ id: qmsRecordId, recordType: "OOS", businessCode: `${prefix}-OOS-${i}`, year, isActive: i % 17 !== 0 });
      oos.push({ id, qmsRecordId, departmentId: departments[i % 2], departmentCodeSnapshot: prefix, departmentNameSnapshot: "Sintético",
        status: i % 10 < 5 ? "OPEN" : i % 10 < 8 ? "CLOSED" : "DRAFT", issueDate: new Date(Date.UTC(year, 0, 1)), lotNumber: `${prefix}-L${i}`, materialName: prefix,
        additionalLots: i % 3 === 0 ? [`${prefix}-X${i}`] : [] });
    }
    for (let i = 0; i < qms.length; i += 400) await prisma.qmsRecord.createMany({ data: qms.slice(i, i + 400) });
    for (let i = 0; i < oos.length; i += 400) await prisma.oosRecord.createMany({ data: oos.slice(i, i + 400) });

    const template = async (module: QmsRecordType, documentType: DocumentType, isActive: boolean) => {
      const row = await prisma.templateVersion.create({ data: { module, documentType, versionCode: `${prefix}-${documentType}-${isActive ? "A" : "I"}`, effectiveFrom: new Date("1990-01-01"), isActive,
        fileName: "fictitious-template.docx", mimeType: docx, fileData: bytes, fileSize: bytes.length, checksum } });
      templateIds.push(row.id);
      return row.id;
    };
    for (const [module, type] of [["DEVIATION", "DEVIATION_ANNEX_III"], ["CAPA", "CAPA_ANNEX_III"], ["CHANGE_CONTROL", "CHANGE_ANNEX_III"]] as const) await template(module, type, true);

    const binaryDetail = { deviation: ids[0][1], capa: ids[1][1], change: ids[2][1], audit: ids[5][1], oos: oosIds[0] };
    const owners: [QmsRecordType, string, DocumentType][] = [
      ["DEVIATION", binaryDetail.deviation, "DEVIATION_ANNEX_III"], ["CAPA", binaryDetail.capa, "CAPA_ANNEX_III"], ["CHANGE_CONTROL", binaryDetail.change, "CHANGE_ANNEX_III"],
      ["AUDIT", binaryDetail.audit, "AUDIT_INTERNAL_REPORT"], ["OOS", binaryDetail.oos, "OOS_ANNEX_III"],
    ];
    for (const [module, id, documentType] of owners) {
      const templateVersionId = await template(module, documentType, false);
      const record = module === "DEVIATION" ? await prisma.deviation.update({ where: { id }, data: { anexoIIITemplateVersionId: templateVersionId } })
        : module === "CAPA" ? await prisma.capa.update({ where: { id }, data: { annexIIITemplateVersionId: templateVersionId } })
        : module === "CHANGE_CONTROL" ? await prisma.changeControl.update({ where: { id }, data: { annexIIITemplateVersionId: templateVersionId } })
        : module === "AUDIT" ? await prisma.audit.findUniqueOrThrow({ where: { id } })
        : await prisma.oosRecord.findUniqueOrThrow({ where: { id } });
      let version = await prisma.qmsRecordVersion.findFirst({ where: { qmsRecordId: record.qmsRecordId }, orderBy: { sequenceNumber: "desc" } });
      version ??= await prisma.qmsRecordVersion.create({ data: { qmsRecordId: record.qmsRecordId, sequenceNumber: 0, kind: "INITIAL", snapshot: { fictitious: prefix } } });
      const kind = module === "OOS" ? "OOS_ANNEX_III_SIGNED" as const : "SIGNED_PDF" as const;
      await prisma.recordVersionDocument.create({ data: { recordVersionId: version.id, kind, fileName: `fictitious-${kind}.pdf`, fileData: bytes, fileSize: bytes.length, checksum, uploadedByText: actor } });
      for (let n = 0; n < 2; n++) await prisma.generatedDocument.create({ data: { qmsRecordId: record.qmsRecordId, recordVersionId: version.id, templateVersionId, documentType,
        fileName: `fictitious-${n}.docx`, mimeType: docx, fileData: bytes, checksum, generatedByText: actor, metadata: { fictitious: true } } });
    }

    return { ...base, oosIds, binaryDetail, cleanup: removeAll };
  } catch (error) {
    await removeAll();
    throw error;
  }
}
