import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";

export function assertSyntheticDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  const database = decodeURIComponent(url.pathname.slice(1));
  const githubService = process.env.GITHUB_ACTIONS === "true" && process.env.CI === "true" && database === "covex_quality";
  assert.equal(process.env.APP_ENV, "test", "APP_ENV=test obligatorio");
  assert.equal(process.env.PHASE3B1_SYNTHETIC_DATABASE, "1", "Confirmar PostgreSQL sintético aislado con PHASE3B1_SYNTHETIC_DATABASE=1");
  const phase3b2Database = database.startsWith("covex_phase3b2_") && process.env.PHASE3B2_SYNTHETIC_DATABASE === "1";
  assert(database.startsWith("covex_phase3b1_") || phase3b2Database || githubService, "Nunca ejecutar sobre la base habitual: usar una base 3B1/3B2 explícitamente sintética o el servicio desechable de GitHub Actions");
  console.log(JSON.stringify({ phase3b1Isolation: { database, host: url.hostname, githubDisposableService: githubService } }));
}

export async function createListFixtures(size = 360) {
  assertSyntheticDatabase();
  const prefix = "P3B1-" + randomUUID().slice(0, 8);
  const departments = [randomUUID(), randomUUID()];
  const owned: string[] = [], audits: string[] = [];
  const ids: string[][] = [[], [], []];
  const recordIds: string[][] = [[], [], []];
  async function cleanup() {
    if (audits.length) {
      await prisma.auditFollowup.deleteMany({ where: { auditId: { in: audits } } });
      await prisma.auditFindingAction.deleteMany({ where: { finding: { auditId: { in: audits } } } });
      await prisma.auditFinding.deleteMany({ where: { auditId: { in: audits } } });
    }
    await prisma.reviewMessage.deleteMany({ where: { reviewThread: { qmsRecordId: { in: owned } } } });
    await prisma.reviewThread.deleteMany({ where: { qmsRecordId: { in: owned } } });
    await prisma.qmsRelation.deleteMany({ where: { OR: [{ sourceRecordId: { in: owned } }, { targetRecordId: { in: owned } }] } });
    await prisma.qmsRecordVersion.deleteMany({ where: { qmsRecordId: { in: owned } } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: owned } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: owned } } });
    await prisma.changeControl.deleteMany({ where: { qmsRecordId: { in: owned } } });
    await prisma.audit.deleteMany({ where: { qmsRecordId: { in: owned } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: owned } } });
    await prisma.department.deleteMany({ where: { id: { in: departments } } });
  }
  try {
    await prisma.department.createMany({ data: departments.map((id, i) => ({ id, code: `QA-${prefix}-${i}`, name: `Departamento sintético ${prefix} ${i}` })) });
    const qms = [], deviations = [], capas = [], changes = [];
    for (let m = 0; m < 3; m++) for (let i = 0; i < size; i++) {
      const id = randomUUID(), qmsRecordId = randomUUID();
      ids[m].push(id); recordIds[m].push(qmsRecordId); owned.push(qmsRecordId);
      const status: "DRAFT" | "CLOSED" | "OPEN" = i === size - 10 ? "DRAFT" : i === size - 9 ? "CLOSED" : "OPEN";
      const date = new Date(i >= 330 ? "2010-01-01" : "2026-01-01");
      const next = i === 333 ? new Date("2099-01-01") : i % 3 === 0 ? null : new Date(i % 3 === 1 ? "2000-01-01" : "2099-01-01");
      qms.push({ id: qmsRecordId, recordType: (["DEVIATION", "CAPA", "CHANGE_CONTROL"] as const)[m], businessCode: `${prefix}-${m}-${String(i).padStart(5, "0")}`, year: i % 2 ? 2025 : 2026, isActive: i !== size - 1 });
      const base = { id, qmsRecordId, departmentId: departments[i % 2], departmentCodeSnapshot: `QA-${i % 2}`, departmentNameSnapshot: "Ficticio", createdAt: new Date("2026-01-01") };
      if (m === 0) deviations.push({ ...base, status, issueDate: date, whatHappened: `${prefix} descripción ${i}`, classification: i % 2 ? "MAJOR" as const : "MINOR" as const });
      if (m === 1) capas.push({ ...base, status, actionType: i % 2 ? "PREVENTIVE" as const : "CORRECTIVE" as const, openedAt: date, defectDescription: `${prefix} defecto ${i}`, nextFollowupDate: next });
      if (m === 2) changes.push({ ...base, finalStatus: status, requestDate: date, description: `${prefix} cambio ${i}`, classification: i % 2 ? "MAJOR" as const : "MINOR" as const });
    }
    await prisma.qmsRecord.createMany({ data: qms });
    await prisma.deviation.createMany({ data: deviations }); await prisma.capa.createMany({ data: capas }); await prisma.changeControl.createMany({ data: changes });
    const actor = "Usuario sintético 3B1";
    const dFollowups = [], cFollowups = [];
    for (let i = 0; i < size; i++) for (let f = 0; f < 2; f++) {
      const next = f === 0 ? new Date("2000-01-01") : i % 3 === 0 ? null : new Date(i % 3 === 1 ? "2000-01-01" : "2099-01-01");
      const date = new Date(f === 0 ? "2026-01-01" : "2026-01-02");
      dFollowups.push({ deviationId: ids[0][i], followupDate: date, completedByText: actor, comment: "Seguimiento ficticio", nextFollowupDate: next });
      cFollowups.push({ changeControlId: ids[2][i], sequenceNumber: f, followupDate: date, responsible: actor, executionStatus: "NOT_EXECUTED" as const, effectivenessStatus: "PENDING" as const, nextFollowupDate: next });
    }
    await prisma.deviationFollowup.createMany({ data: dFollowups }); await prisma.changeControlFollowup.createMany({ data: cFollowups });
    await prisma.capaPlannedAction.createMany({ data: [0, 1].map(i => ({ capaId: ids[1][0], description: `${prefix} acción visible ${i}`, sortOrder: i, plannedExecutionDate: new Date(i ? "2026-05-01" : "2026-04-01") })) });
    await prisma.changeControlTask.create({ data: { changeControlId: ids[2][0], description: `${prefix} tarea visible`, plannedDate: new Date("2026-05-01"), origin: "DICTAMEN" } });
    await prisma.qmsRelation.create({ data: { sourceRecordId: recordIds[0][0], targetRecordId: recordIds[1][0], relationType: "GENERATES" } });
    await prisma.qmsRelation.create({ data: { sourceRecordId: recordIds[0][1], targetRecordId: recordIds[1][1], relationType: "GENERATES", isActive: false } });
    await prisma.qmsRecordVersion.createMany({ data: [0, 1, 2].map(sequenceNumber => ({ qmsRecordId: recordIds[1][0], sequenceNumber, kind: "FOLLOWUP" as const, frozenAt: sequenceNumber < 2 ? new Date("2026-01-01") : null, snapshot: { synthetic: true, text: "X".repeat(4096) } })) });
    for (let i = 0; i < 7; i++) {
      const q = await prisma.qmsRecord.create({ data: { recordType: "AUDIT", businessCode: `${prefix}-AUD-${i}`, year: 2026, audit: { create: { title: `${prefix} auditoría ${i}`, status: "OPEN", scenario: "INTERNAL_COVEX", auditType: "INTERNAL" } } }, include: { audit: true } });
      owned.push(q.id); audits.push(q.audit!.id);
    }
    const active = await prisma.auditFinding.create({ data: { auditId: audits[1], reference: "OBS-A", findingType: "FINDING", description: "Hallazgo activo ficticio", createdByText: actor } });
    const retired = await prisma.auditFinding.create({ data: { auditId: audits[2], reference: "OBS-R", findingType: "FINDING", description: "Hallazgo retirado ficticio", isActive: false, createdByText: actor } });
    const followup = async (i: number, day: string, due: string | null, findingId?: string) => prisma.auditFollowup.create({ data: { auditId: audits[i], findingId, followupDate: new Date(day), nextReviewDate: due ? new Date(due) : null, completedByText: actor, createdByText: actor, description: "Seguimiento ficticio" } });
    await followup(0, "2026-01-01", "2026-02-01"); await followup(0, "2026-01-02", null);
    await followup(1, "2026-01-01", "2026-02-01", active.id); await followup(1, "2026-01-03", null);
    await followup(2, "2026-01-01", "2026-02-01", retired.id);
    // A foreign historical scope must be excluded even if its finding is active.
    await followup(6, "2026-01-01", "2026-02-01", active.id);
    await followup(3, "2026-01-01", "2026-02-28"); await followup(4, "2026-01-01", "2026-03-01");
    await followup(5, "2026-01-01", "2026-02-01"); await followup(5, "2026-01-02", "2026-12-31");
    const auditRecord = owned[owned.length - 6];
    for (const qmsRecordId of [recordIds[0][0], recordIds[1][0], recordIds[2][0], auditRecord]) {
      for (const status of ["PENDING", "ACCEPTED", "RESOLVED"] as const) await prisma.reviewThread.create({ data: { qmsRecordId, targetKind: "RECORD", status, createdByText: actor, messages: { create: { message: "Comentario sintético", createdByText: actor } } } });
    }
    return { prefix, departments, ids, recordIds, owned, audits, size, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
