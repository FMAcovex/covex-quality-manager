import { purgeLegacyFixtureDocuments } from "./audit-fixtures/legacy-cleanup";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { isolatedTestEnvironment } from "../src/lib/auth/config";

export function assertPhase3b2Database() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const database = decodeURIComponent(url.pathname.slice(1));
  const disposableCI = process.env.GITHUB_ACTIONS === "true" && process.env.CI === "true" && database === "covex_quality";
  assert.equal(process.env.APP_ENV, "test");
  assert.equal(process.env.PHASE3B2_SYNTHETIC_DATABASE, "1");
  assert(database.startsWith("covex_phase3b2_") || disposableCI || isolatedTestEnvironment(), "Only a new disposable synthetic database is allowed");
  return { database, host: url.hostname, disposableCI };
}

async function insert<T>(rows: T[], create: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 400) await create(rows.slice(i, i + 400));
}

export async function phase3b2ComparisonFixtures(size = 1000) {
  const path = process.env.PHASE3B2_EXISTING_FIXTURE;
  if (!path) return createPhase3b2Fixtures(size);
  assertPhase3b2Database();
  const fixture = JSON.parse(readFileSync(path, "utf8")) as { prefix: string; departments: string[]; masters: number; size: number };
  assert.match(fixture.prefix, /^P3B2-[0-9a-f]{8}$/);
  const qmsIds = (await prisma.qmsRecord.findMany({ where: { businessCode: { startsWith: fixture.prefix + "-" } }, select: { id: true } })).map(row => row.id);
  assert.equal(qmsIds.length, fixture.size);
  assert.equal(fixture.departments.length, 2);
  return { prefix: fixture.prefix, departments: fixture.departments, qmsIds, masterSize: fixture.masters, cleanup: async () => {} };
}

export async function createPhase3b2Fixtures(size = 1000, freezeHistory = false, documentarySnapshots = false) {
  assertPhase3b2Database();
  const prefix = "P3B2-" + randomUUID().slice(0, 8);
  const departments = [randomUUID(), randomUUID()];
  const qmsIds: string[] = [], docIds: string[] = [], ruleKeys: string[] = [];
  const ids: string[][] = [[], [], [], [], [], []];
  const actor = "Actor sintético 3B2";
  const kinds = ["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT"] as const;
  const qms: Prisma.QmsRecordCreateManyInput[] = [], versions: Prisma.QmsRecordVersionCreateManyInput[] = [];
  const dev: Prisma.DeviationCreateManyInput[] = [], capa: Prisma.CapaCreateManyInput[] = [];
  const cc: Prisma.ChangeControlCreateManyInput[] = [], rec: Prisma.ComplaintCreateManyInput[] = [];
  const ret: Prisma.ReturnRecordCreateManyInput[] = [], aud: Prisma.AuditCreateManyInput[] = [];
  const df: Prisma.DeviationFollowupCreateManyInput[] = [], cf: Prisma.CapaFollowupCreateManyInput[] = [];
  const ccf: Prisma.ChangeControlFollowupCreateManyInput[] = [], rf: Prisma.ComplaintFollowupCreateManyInput[] = [];
  const rtf: Prisma.ReturnFollowupCreateManyInput[] = [], af: Prisma.AuditFollowupCreateManyInput[] = [];
  const ad: Prisma.AuditDepartmentCreateManyInput[] = [];
  const occupiedCodes = new Set((await prisma.department.findMany({ where: { code: { startsWith: "ZZ-" } }, select: { code: true } })).map(row => row.code));
  const departmentCodes = Array.from({ length: 100 }, (_, i) => "ZZ-" + String(i).padStart(2, "0")).filter(code => !occupiedCodes.has(code)).slice(0, 2);
  assert.equal(departmentCodes.length, 2, "Two unused synthetic PNT departments required");
  await prisma.department.createMany({ data: departments.map((id, i) => ({ id, code: departmentCodes[i], name: prefix + " Ficticio " + i })) });
  const rules = [
    ["CAPA_FOLLOWUP_DUE", "CAPA", "FOLLOWUP_DUE"], ["CAPA_EFFECTIVENESS_PENDING", "CAPA", "EFFECTIVENESS_PENDING"],
    ["CHANGE_FOLLOWUP_DUE", "CHANGE_CONTROL", "FOLLOWUP_DUE"], ["CHANGE_PLANNED_EXECUTION_DUE", "CHANGE_CONTROL", "PLANNED_EXECUTION_DUE"],
    ["COMPLAINT_FOLLOWUP_DUE", "COMPLAINT", "FOLLOWUP_DUE"], ["RETURN_FOLLOWUP_DUE", "RETURN", "FOLLOWUP_DUE"],
  ] as const;
  for (const [key, module, kind] of rules) if (!await prisma.alertRule.findUnique({ where: { key } })) {
    await prisma.alertRule.create({ data: { key, module, kind, label: "Regla ficticia", leadDays: key.includes("EFFECTIVENESS") ? 7 : 30 } });
    ruleKeys.push(key);
  }
  for (let n = 0; n < size; n++) {
    const m = n % 6, i = Math.floor(n / 6), id = randomUUID(), qmsRecordId = randomUUID();
    ids[m].push(id); qmsIds.push(qmsRecordId);
    const year = 2022 + i % 5;
    const date = new Date(Date.UTC(year, 0, 1));
    const status = i % 10 < 5 ? "OPEN" as const : i % 10 < 8 ? "CLOSED" as const : "DRAFT" as const;
    const due = i % 4 === 0 ? null : new Date(["2026-10-10", "2026-10-11", "2026-11-10", "2027-01-01"][i % 4]);
    qms.push({ id: qmsRecordId, recordType: kinds[m], businessCode: prefix + "-" + kinds[m] + "-" + i, year: i % 13 === 0 ? null : year, isActive: i % 17 !== 0 });
    const base = { id, qmsRecordId, departmentId: departments[i % 2], departmentCodeSnapshot: prefix, departmentNameSnapshot: "Sintético", includeInKpi: i % 19 !== 0 };
    if (m === 0) dev.push({ ...base, status, issueDate: date, whatHappened: prefix, investigation: "Ficticio ".repeat(200) });
    if (m === 1) capa.push({ ...base, status: i % 23 === 1 ? "CANCELLED" : status, actionType: "CORRECTIVE", openedAt: date, operationalClosedAt: status === "CLOSED" ? date : null, effectivenessStatus: i % 2 ? "PENDING" : "CONFORMING" });
    if (m === 2) cc.push({ ...base, finalStatus: status, requestDate: date, plannedImplementationDate: due, executionStatus: i % 2 ? "NOT_EXECUTED" : "EXECUTED" });
    if (m === 3) rec.push({ ...base, status, complaintType: "CUSTOMER", openedAt: date });
    if (m === 4) ret.push({ ...base, status, returnType: "COMMERCIAL", communicationDate: date, customerEntity: prefix });
    if (m === 5) {
      aud.push({ id, qmsRecordId, status, auditType: "INTERNAL", scenario: "INTERNAL_COVEX", title: prefix, plannedDate: date });
      for (const departmentId of departments) ad.push({ auditId: id, departmentId, departmentCodeSnapshot: prefix, departmentNameSnapshot: "Sintético", isActive: departmentId === departments[0] || i % 3 !== 0 });
    }
    for (let v = 0; v < 3; v++) {
      const snapshotKey = ["deviation", "capa", "changeControl", "complaint", "returnRecord", "audit"][m];
      const snapshot: Prisma.InputJsonObject = { fictitious: prefix, payload: "X".repeat(2048), sequence: v };
      if (documentarySnapshots) Object.assign(snapshot, { recordType: kinds[m], businessCode: prefix + "-" + kinds[m] + "-" + i, year,
        [snapshotKey]: { status, finalStatus: status, openedAt: date.toISOString(), communicationDate: date.toISOString(), versionFollowupDate: new Date("2026-10-01").toISOString(), nextFollowupDate: due?.toISOString() ?? null, followups: [], products: [], capaPlans: [], derivedActions: [] } });
      versions.push({ id: randomUUID(), qmsRecordId, sequenceNumber: v, kind: v ? "FOLLOWUP" : "INITIAL", frozenAt: freezeHistory && v < 2 ? new Date("2026-01-01") : null, snapshot });
    }
    for (let f = 0; f < 5; f++) {
      const followupDate = new Date(Date.UTC(2026, 9, 1 + f));
      const nextFollowupDate = f === 4 ? due : new Date("2020-01-01");
      const common = { followupDate, nextFollowupDate, completedByText: actor };
      if (m === 0) df.push({ ...common, deviationId: id, comment: "Seguimiento ficticio" });
      if (m === 1) cf.push({ ...common, capaId: id, sequenceNumber: f, description: "Seguimiento ficticio" });
      if (m === 2) ccf.push({ changeControlId: id, sequenceNumber: f, followupDate, nextFollowupDate, responsible: actor, executionStatus: "NOT_EXECUTED", effectivenessStatus: "PENDING" });
      if (m === 3) rf.push({ ...common, complaintId: id, comment: "Seguimiento ficticio" });
      if (m === 4) rtf.push({ ...common, returnRecordId: id, comment: "Seguimiento ficticio" });
      if (m === 5) af.push({ auditId: id, followupDate, nextReviewDate: nextFollowupDate, completedByText: actor, createdByText: actor, description: "Seguimiento ficticio" });
    }
  }
  await insert(qms, data => prisma.qmsRecord.createMany({ data }));
  await insert(dev, data => prisma.deviation.createMany({ data }));
  await insert(capa, data => prisma.capa.createMany({ data }));
  await insert(cc, data => prisma.changeControl.createMany({ data }));
  await insert(rec, data => prisma.complaint.createMany({ data }));
  await insert(ret, data => prisma.returnRecord.createMany({ data }));
  await insert(aud, data => prisma.audit.createMany({ data }));
  await insert(ad, data => prisma.auditDepartment.createMany({ data }));
  await insert(versions, data => prisma.qmsRecordVersion.createMany({ data }));
  await insert(df, data => prisma.deviationFollowup.createMany({ data }));
  await insert(cf, data => prisma.capaFollowup.createMany({ data }));
  await insert(ccf, data => prisma.changeControlFollowup.createMany({ data }));
  await insert(rf, data => prisma.complaintFollowup.createMany({ data }));
  await insert(rtf, data => prisma.returnFollowup.createMany({ data }));
  await insert(af, data => prisma.auditFollowup.createMany({ data }));
  // Latest general null must not hide the active finding; withdrawn and foreign scopes are ignored.
  const audit = ids[5][1];
  const finding = await prisma.auditFinding.create({ data: { auditId: audit, reference: "OBS/1", findingType: "FINDING", description: "Ficticio", createdByText: actor } });
  const withdrawn = await prisma.auditFinding.create({ data: { auditId: audit, reference: "OBS/2", findingType: "FINDING", description: "Retirado", createdByText: actor, isActive: false } });
  for (const findingId of [finding.id, withdrawn.id]) await prisma.auditFollowup.create({ data: { auditId: audit, findingId, followupDate: new Date("2026-10-06"), nextReviewDate: new Date("2026-10-10"), completedByText: actor, createdByText: actor, description: "Ficticio" } });
  await prisma.auditFollowup.create({ data: { auditId: audit, followupDate: new Date("2026-10-07"), nextReviewDate: null, completedByText: actor, createdByText: actor, description: "Borra solo el ámbito general" } });
  const foreign = await prisma.auditFinding.create({ data: { auditId: ids[5][2], reference: "OBS/1", findingType: "FINDING", description: "Otro expediente", createdByText: actor } });
  await prisma.auditFollowup.create({ data: { auditId: audit, findingId: foreign.id, followupDate: new Date("2026-10-08"), nextReviewDate: new Date("2020-01-01"), completedByText: actor, createdByText: actor, description: "Referencia histórica ajena" } });

  const masters: Prisma.ControlledDocumentCreateManyInput[] = [], revisions: Prisma.ControlledDocumentRevisionCreateManyInput[] = [];
  const lifecycle: Prisma.ControlledRevisionLifecycleCreateManyInput[] = [];
  const masterSize = Math.max(90, Math.floor(size / 10));
  for (let i = 0; i < masterSize; i++) {
    const id = randomUUID(); docIds.push(id);
    masters.push({ id, baseCode: departmentCodes[i % 2] + "/" + String(Math.floor(i / 2)).padStart(3, "0"), title: prefix + " " + ["Árbol 2", "arbol 10", "Ñandú", "Nandu", "Texto"][i % 5] + " " + i,
      departmentId: departments[i % 2], departmentCodeSnapshot: departmentCodes[i % 2], departmentNameSnapshot: "Ficticio",
      administrativeStatus: i % 9 === 0 ? "ANNULLED" : i % 7 === 0 ? "DRAFT" : "ACTIVE", createdByText: actor, sourceMetadata: { fictitious: prefix, payload: "M".repeat(2048) } });
    const count = i % 11 === 0 ? 0 : i % 13 === 0 ? 1 : 3;
    for (let v = 0; v < count; v++) {
      const revisionId = randomUUID();
      revisions.push({ id: revisionId, documentId: id, revisionCode: String(v).padStart(2, "0"), status: v === 0 ? "IN_FORCE" : v === 1 ? "OBSOLETE" : "DRAFT",
        verificationStatus: i % 3 ? "UNVERIFIED" : "VERIFIED", effectiveFrom: new Date("2025-01-01"), reviewDueAt: new Date(i % 2 ? "2026-10-10" : "2027-01-01"), sourceReference: prefix + "-source-" + i, registeredByText: actor, sourceMetadata: { fictitious: prefix, payload: "R".repeat(2048) } });
      if (i % 4 === 0) lifecycle.push({ revisionId, documentId: id, effectiveFrom: i % 8 === 0 ? null : new Date("2026-01-01"), reviewDueAt: i % 8 === 0 ? null : new Date("2026-11-10") });
    }
  }
  await insert(masters, data => prisma.controlledDocument.createMany({ data }));
  await insert(revisions, data => prisma.controlledDocumentRevision.createMany({ data }));
  await insert(lifecycle, data => prisma.controlledRevisionLifecycle.createMany({ data }));
  const bytes = randomBytes(1048576), checksum = createHash("sha256").update(bytes).digest("hex");
  const binaryIds: string[] = [], templateIds: string[] = [];
  for (const m of [3, 4]) {
    const record = await (m === 3 ? prisma.complaint.findUniqueOrThrow({ where: { id: ids[m][1] } }) : prisma.returnRecord.findUniqueOrThrow({ where: { id: ids[m][1] } }));
    const recordVersions = await prisma.qmsRecordVersion.findMany({ where: { qmsRecordId: record.qmsRecordId }, orderBy: { sequenceNumber: "asc" } });
    const template = await prisma.templateVersion.create({ data: {
      module: m === 3 ? "COMPLAINT" : "RETURN", documentType: m === 3 ? "COMPLAINT_ANNEX_III" : "RETURN_ANNEX_III",
      versionCode: prefix, effectiveFrom: new Date("1990-01-01"), isActive: false,
      fileName: "fictitious-template.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileData: bytes, fileSize: bytes.length, checksum,
    } });
    templateIds.push(template.id);
    if (m === 3) await prisma.complaint.update({ where: { id: record.id }, data: { annexIIITemplateVersionId: template.id } });
    else await prisma.returnRecord.update({ where: { id: record.id }, data: { annexIIITemplateVersionId: template.id } });
    for (const version of recordVersions) {
      const kinds = m === 3 ? ["SIGNED_PDF"] as const : ["RETURN_ANNEX_III_SIGNED", "RETURN_ANNEX_V_SIGNED"] as const;
      for (const kind of kinds) {
        const document = await prisma.recordVersionDocument.create({ data: { recordVersionId: version.id, kind, fileName: "fictitious-" + kind + "-" + version.sequenceNumber + ".pdf", fileData: bytes, fileSize: bytes.length, checksum, uploadedByText: actor } });
        binaryIds.push(document.id);
        if (m === 4) await prisma.generatedDocument.create({ data: { qmsRecordId: record.qmsRecordId, recordVersionId: version.id, documentType: kind === "RETURN_ANNEX_III_SIGNED" ? "RETURN_ANNEX_III" : "RETURN_ANNEX_V", fileName: document.fileName, mimeType: "application/pdf", fileData: bytes, checksum, generatedByText: actor, metadata: { fictitious: true, kind } } });
      }
    }
    await prisma.generatedDocument.create({ data: { qmsRecordId: record.qmsRecordId, recordVersionId: recordVersions[0].id, documentType: m === 3 ? "COMPLAINT_ANNEX_III" : "RETURN_ANNEX_III", fileName: "fictitious-history.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileData: bytes, checksum, metadata: { fictitious: true }, generatedByText: actor } });
  }
  async function cleanup() {
    await purgeLegacyFixtureDocuments(prisma, { recordVersion: { qmsRecordId: { in: qmsIds } } });
    await prisma.recordVersionDocument.deleteMany({ where: { recordVersion: { qmsRecordId: { in: qmsIds } } } });
    await prisma.generatedDocument.deleteMany({ where: { qmsRecordId: { in: qmsIds } } });
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: qmsIds } } });
    await prisma.deviationFollowup.deleteMany({ where: { deviationId: { in: ids[0] } } });
    await prisma.capaFollowup.deleteMany({ where: { capaId: { in: ids[1] } } });
    await prisma.changeControlFollowup.deleteMany({ where: { changeControlId: { in: ids[2] } } });
    await prisma.complaintFollowup.deleteMany({ where: { complaintId: { in: ids[3] } } });
    await prisma.returnFollowup.deleteMany({ where: { returnRecordId: { in: ids[4] } } });
    await prisma.auditFollowup.deleteMany({ where: { auditId: { in: ids[5] } } });
    await prisma.auditFinding.deleteMany({ where: { auditId: { in: ids[5] } } });
    await prisma.auditDepartment.deleteMany({ where: { auditId: { in: ids[5] } } });
    await prisma.deviation.deleteMany({ where: { id: { in: ids[0] } } });
    await prisma.capa.deleteMany({ where: { id: { in: ids[1] } } });
    await prisma.changeControl.deleteMany({ where: { id: { in: ids[2] } } });
    await prisma.complaint.deleteMany({ where: { id: { in: ids[3] } } });
    await prisma.returnRecord.deleteMany({ where: { id: { in: ids[4] } } });
    await prisma.audit.deleteMany({ where: { id: { in: ids[5] } } });
    await prisma.templateVersion.deleteMany({ where: { id: { in: templateIds } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: qmsIds } } });
    await prisma.controlledRevisionLifecycle.deleteMany({ where: { documentId: { in: docIds } } });
    await prisma.controlledDocumentRevision.deleteMany({ where: { documentId: { in: docIds } } });
    await prisma.controlledDocument.deleteMany({ where: { id: { in: docIds } } });
    await prisma.alertRule.deleteMany({ where: { key: { in: ruleKeys } } });
    await prisma.department.deleteMany({ where: { id: { in: departments } } });
  }
  return { prefix, departments, ids, qmsIds, docIds, binaryIds, templateIds, bytes, checksum, masterSize, cleanup };
}
