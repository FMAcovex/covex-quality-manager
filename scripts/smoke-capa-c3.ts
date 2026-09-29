import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { saveCapaFollowup } from "../src/modules/capa/followup-service";
import { capaSnapshotToAnnexRecord } from "../src/lib/qms/versioning";
import { resolveCapaFollowupVersion } from "../src/modules/capa/followup-version-ui";
import { getZipEntryText, readZip } from "../src/lib/ooxml/zip";

const prisma = new PrismaClient();
const baseUrl = process.env.C3_BASE_URL?.replace(/\/$/, "");
const actor = "CI C3";
const code = `AC/C3/${Date.now()}/2097`;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function followup(capaId: string, fields: Record<string, string>) {
  const result = await saveCapaFollowup(capaId, form(fields));
  assert.equal(result.error, undefined, result.error);
  assert.ok(result.success);
}

async function checkDownloads(capaId: string, recordId: string, versions: Array<{ id: string; sequenceNumber: number }>) {
  if (!baseUrl) return;
  for (const version of versions) {
    const response = await fetch(`${baseUrl}/api/capa/${capaId}/annex-iii?version=${version.sequenceNumber}`);
    if (response.status !== 200) throw new Error(`Anexo III V${version.sequenceNumber}: HTTP ${response.status} ${await response.text()}`);
    assert.match(response.headers.get("content-type") ?? "", /wordprocessingml.document/);
    assert.match(response.headers.get("content-disposition") ?? "", new RegExp(`_V0${version.sequenceNumber}\\.docx`));
    const entries = readZip(Buffer.from(await response.arrayBuffer()));
    const xml = getZipEntryText(entries, "word/document.xml");
    assert.match(xml, new RegExp(`C3 MARCA V0${version.sequenceNumber}`));
    if (version.sequenceNumber < 2) assert.doesNotMatch(xml, /C3 MARCA V02/);
    if (version.sequenceNumber === 0) assert.doesNotMatch(xml, /C3 MARCA V01/);
    const document = await prisma.generatedDocument.findFirst({
      where: { qmsRecordId: recordId, recordVersionId: version.id, documentType: "CAPA_ANNEX_III" },
      orderBy: { generatedAt: "desc" },
    });
    assert.ok(document, `Falta GeneratedDocument de V${version.sequenceNumber}`);
  }
}

async function main() {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const record = await prisma.qmsRecord.create({
    data: { recordType: QmsRecordType.CAPA, businessCode: code, year: 2097 },
  });
  try {
    const capa = await prisma.capa.create({
      data: {
        qmsRecordId: record.id, actionType: "CORRECTIVE",
        departmentId: department.id, departmentCodeSnapshot: department.code,
        departmentNameSnapshot: department.name, openedAt: new Date("2097-01-01"),
        createdByText: actor, defectDescription: "C3 MARCA V00",
        rootCause: "Causa ficticia C3", status: "OPEN", effectivenessStatus: "PENDING",
        plannedActions: { create: { description: "Acción ficticia C3", responsible: actor, sortOrder: 0 } },
      },
    });

    await followup(capa.id, {
      followupDate: "2097-01-10", completedByText: actor, reason: "Revisión inicial",
      description: "C3 MARCA V01", evidenceReference: "EV-C3-01",
      nextFollowupDate: "2097-02-10", status: "OPEN", effectivenessStatus: "PENDING",
    });
    await followup(capa.id, {
      followupDate: "2097-02-10", completedByText: actor, reason: "Cierre y eficacia",
      description: "C3 MARCA V02", evidenceReference: "EV-C3-02",
      status: "CLOSED", operationalClosedAt: "2097-02-10",
      conclusion: "Acción implantada con evidencia.",
      effectivenessStatus: "CONFORMING", effectivenessCriteria: "Sin recurrencia",
      effectivenessAssessment: "Conforme", effectivenessEvidence: "EV-C3-EF",
      effectiveClosedAt: "2097-02-10",
    });

    const stored = await prisma.capa.findUniqueOrThrow({
      where: { id: capa.id },
      include: { followups: { orderBy: { sequenceNumber: "asc" } },
        qmsRecord: { include: { versions: { orderBy: { sequenceNumber: "asc" } } } } },
    });
    const versions = stored.qmsRecord.versions;
    assert.deepEqual(versions.map(v => v.sequenceNumber), [0, 1, 2]);
    assert.deepEqual(versions.map(v => v.kind), ["INITIAL", "FOLLOWUP", "FOLLOWUP"]);
    assert.equal(stored.followups.length, 2);
    assert.equal(versions[1].sourceEntityId, stored.followups[0].id);
    assert.equal(versions[2].sourceEntityId, stored.followups[1].id);
    assert.equal(versions[0].frozenAt !== null, true);
    assert.equal(versions[1].frozenAt !== null, true);
    assert.equal(versions[2].frozenAt, null);
    for (const item of stored.followups) {
      assert.equal(resolveCapaFollowupVersion(versions, item)?.sequenceNumber, item.sequenceNumber);
    }
    type HistoricalCapa = {
      status: string;
      effectivenessStatus: string;
      defectDescription: string;
      followups: Array<{ description: string }>;
      effectiveClosedAt: Date | null;
    };
    const [v00, v01, v02] = versions.map(v =>
      capaSnapshotToAnnexRecord(v.snapshot) as unknown as HistoricalCapa
    );
    assert.equal(v00.status, "OPEN");
    assert.equal(v00.followups.length, 0);
    assert.equal(v00.defectDescription, "C3 MARCA V00");
    assert.equal(v01.status, "OPEN");
    assert.equal(v01.effectivenessStatus, "PENDING");
    assert.equal(v01.followups.length, 1);
    assert.equal(v01.followups[0].description, "C3 MARCA V01");
    assert.equal(v02.status, "CLOSED");
    assert.equal(v02.effectivenessStatus, "CONFORMING");
    assert.equal(v02.followups.length, 2);
    assert.equal(v02.followups[0].description, "C3 MARCA V02");
    assert.equal(v00.effectiveClosedAt, null);
    assert.equal(v01.effectiveClosedAt, null);
    assert.ok(v02.effectiveClosedAt);

    await checkDownloads(capa.id, record.id, versions);
    console.log(`C3 CAPA V00→V01→V02, snapshots e histórico: correcto${baseUrl ? "; tres Anexos III DOCX descargados y vinculados" : "; descarga pendiente de C3_BASE_URL y plantilla oficial"}.`);
  } finally {
    await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: record.id } });
    await prisma.changeHistory.deleteMany({ where: { qmsRecordId: record.id } });
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: record.id } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: record.id } });
    await prisma.qmsRecord.delete({ where: { id: record.id } });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
