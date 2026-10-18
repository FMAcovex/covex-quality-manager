import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { identityContext, type Principal } from "../src/lib/auth/context";
import { assignedWhere } from "../src/lib/qms/assigned";
import { getAssignedItems } from "../src/modules/dashboard/assigned-query";
import { getDeviationList } from "../src/modules/deviations/queries";
import { getCapaList } from "../src/modules/capa/queries";
import { getChangeControlList } from "../src/modules/change-control/queries";
import { getComplaintList } from "../src/modules/complaints/queries";
import { getAuditList } from "../src/modules/audits/queries";

// D-102: «Asignadas a mí» en el panel y en los listados, con la misma definición de pendiente.
const year = 2096;
const marker = "D102-" + randomUUID().slice(0, 8);
const ids: string[] = [];
const past = new Date(Date.UTC(2020, 0, 1));

async function record(recordType: "DEVIATION" | "CAPA" | "CHANGE_CONTROL" | "COMPLAINT" | "AUDIT", suffix: string) {
  const row = await prisma.qmsRecord.create({ data: { recordType, businessCode: `${marker}-${suffix}`, year } });
  ids.push(row.id);
  return row.id;
}

async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("El smoke D-102 requiere una base ficticia con APP_ENV=test.");
  const [me, other] = await prisma.authUser.findMany({ where: { active: true, authorizedAt: { not: null } }, orderBy: { id: "asc" }, take: 2 });
  assert(me && other, "Hacen falta dos usuarios activos (auth:fixtures).");
  try {
    // Desviaciones: solo la abierta con CAPA propuesta a mi cargo.
    const devOpen = await prisma.deviation.create({ data: { qmsRecordId: await record("DEVIATION", "DEV1"), status: "OPEN", provenance: "OTHER" } });
    await prisma.deviationCapaPlan.create({ data: { deviationId: devOpen.id, actionType: "CORRECTIVE", description: "Plan vencido", responsibleUserId: me.id, plannedExecutionDate: past } });
    const devRegistered = await prisma.deviation.create({ data: { qmsRecordId: await record("DEVIATION", "DEV2"), status: "OPEN", provenance: "OTHER" } });
    await prisma.deviationCapaPlan.create({ data: { deviationId: devRegistered.id, actionType: "CORRECTIVE", description: "Ya creada", responsibleUserId: me.id, proposalStatus: "REGISTERED" } });
    const devClosed = await prisma.deviation.create({ data: { qmsRecordId: await record("DEVIATION", "DEV3"), status: "CLOSED", provenance: "OTHER" } });
    await prisma.deviationCapaPlan.create({ data: { deviationId: devClosed.id, actionType: "CORRECTIVE", description: "Cerrada", responsibleUserId: me.id } });
    const devOther = await prisma.deviation.create({ data: { qmsRecordId: await record("DEVIATION", "DEV4"), status: "OPEN", provenance: "OTHER" } });
    await prisma.deviationCapaPlan.create({ data: { deviationId: devOther.id, actionType: "CORRECTIVE", description: "De otro", responsibleUserId: other.id } });

    // CAPA: abierta sí, cerrada no.
    const capaOpen = await prisma.capa.create({ data: { qmsRecordId: await record("CAPA", "CAPA1"), status: "OPEN", actionType: "CORRECTIVE" } });
    await prisma.capaPlannedAction.create({ data: { capaId: capaOpen.id, description: "Acción sin fecha", responsibleUserId: me.id } });
    const capaClosed = await prisma.capa.create({ data: { qmsRecordId: await record("CAPA", "CAPA2"), status: "CLOSED", actionType: "CORRECTIVE" } });
    await prisma.capaPlannedAction.create({ data: { capaId: capaClosed.id, description: "Cerrada", responsibleUserId: me.id } });

    // Cambios: decisión pendiente; seguimiento con Dictamen aprobado; acción completada (no) y pendiente (sí).
    await prisma.changeControl.create({ data: { qmsRecordId: await record("CHANGE_CONTROL", "CC1"), finalStatus: "OPEN", requestDecision: "PENDING", requestDecisionResponsibleUserId: me.id } });
    const ccFollow = await prisma.changeControl.create({ data: { qmsRecordId: await record("CHANGE_CONTROL", "CC2"), finalStatus: "OPEN", requestDecision: "ACCEPTED", dictamenResult: "APPROVED", followupResponsibleUserId: me.id } });
    const done = await prisma.changeControlTask.create({ data: { changeControlId: ccFollow.id, description: "Hecha", origin: "DICTAMEN", responsibleUserId: me.id } });
    await prisma.changeControlTask.create({ data: { changeControlId: ccFollow.id, description: "Pendiente", origin: "DICTAMEN", responsibleUserId: me.id, plannedDate: past } });
    const followup = await prisma.changeControlFollowup.create({ data: { changeControlId: ccFollow.id, sequenceNumber: 0, followupDate: past, responsible: "QA", executionStatus: "NOT_EXECUTED", effectivenessStatus: "PENDING", nextFollowupDate: past } });
    await prisma.changeControlTaskState.create({ data: { followupId: followup.id, taskId: done.id, status: "COMPLETED" } });
    const ccOnlyDone = await prisma.changeControl.create({ data: { qmsRecordId: await record("CHANGE_CONTROL", "CC3"), finalStatus: "OPEN", requestDecision: "ACCEPTED" } });
    const onlyDone = await prisma.changeControlTask.create({ data: { changeControlId: ccOnlyDone.id, description: "Hecha", origin: "DICTAMEN", responsibleUserId: me.id } });
    const followup3 = await prisma.changeControlFollowup.create({ data: { changeControlId: ccOnlyDone.id, sequenceNumber: 0, followupDate: past, responsible: "QA", executionStatus: "NOT_EXECUTED", effectivenessStatus: "PENDING" } });
    await prisma.changeControlTaskState.create({ data: { followupId: followup3.id, taskId: onlyDone.id, status: "NOT_APPLICABLE" } });

    // Reclamaciones: acción derivada a mi cargo en una abierta.
    const complaint = await prisma.complaint.create({ data: { qmsRecordId: await record("COMPLAINT", "REC1"), status: "OPEN", complaintType: "CUSTOMER" } });
    await prisma.complaintDerivedAction.create({ data: { complaintId: complaint.id, actionType: "RETURN", description: "Devolución", responsibleUserId: me.id } });

    // Auditorías: acción abierta sí; cerrada o retirada no.
    const audit = await prisma.audit.create({ data: { qmsRecordId: await record("AUDIT", "AUD1"), status: "OPEN" } });
    const finding = await prisma.auditFinding.create({ data: { auditId: audit.id, reference: "OBS 01", findingType: "FINDING", description: "Hallazgo", createdByText: "QA" } });
    await prisma.auditFindingAction.create({ data: { findingId: finding.id, description: "Abierta", createdByText: "QA", responsibleUserId: me.id, status: "IN_PROGRESS" } });
    await prisma.auditFindingAction.create({ data: { findingId: finding.id, description: "Cerrada", createdByText: "QA", responsibleUserId: me.id, status: "CLOSED" } });
    await prisma.auditFindingAction.create({ data: { findingId: finding.id, description: "Retirada", createdByText: "QA", responsibleUserId: me.id, isActive: false } });
    const auditClosedOnly = await prisma.audit.create({ data: { qmsRecordId: await record("AUDIT", "AUD2"), status: "OPEN" } });
    const finding2 = await prisma.auditFinding.create({ data: { auditId: auditClosedOnly.id, reference: "OBS 01", findingType: "FINDING", description: "Hallazgo", createdByText: "QA" } });
    await prisma.auditFindingAction.create({ data: { findingId: finding2.id, description: "Cerrada", createdByText: "QA", responsibleUserId: me.id, status: "CLOSED" } });

    // Panel: una fila por acción pendiente, con su estado.
    const items = await getAssignedItems(me.id, { year, department: "", module: "ALL", asOf: new Date() });
    assert.deepEqual(items.map((item) => [item.code, item.label, item.state]).sort(), [
      [`${marker}-AUD1`, "Acción del hallazgo OBS 01", "PENDING"],
      [`${marker}-CAPA1`, "Acción propuesta", "PENDING"],
      [`${marker}-CC1`, "Decisión de la solicitud pendiente", "PENDING"],
      [`${marker}-CC2`, "Acción del plan", "OVERDUE"],
      [`${marker}-CC2`, "Seguimiento del cambio", "OVERDUE"],
      [`${marker}-DEV1`, "CAPA propuesta sin crear", "OVERDUE"],
      [`${marker}-REC1`, "Devolución propuesta", "PENDING"],
    ].sort());
    assert.equal(items.at(-1)!.dueDate, null, "las que no tienen fecha van al final");
    assert.deepEqual((await getAssignedItems(me.id, { year, department: "", module: "CAPA", asOf: new Date() })).map((item) => item.code), [`${marker}-CAPA1`]);
    assert.deepEqual(await getAssignedItems(null, { year, department: "", module: "ALL", asOf: new Date() }), []);
    assert.deepEqual((await getAssignedItems(other.id, { year, department: "", module: "ALL", asOf: new Date() })).map((item) => item.code), [`${marker}-DEV4`]);

    // Listados: los mismos expedientes, con el usuario de la sesión.
    const principal = { id: me.id, name: me.displayName } as Principal;
    const codes = (rows: Array<{ qmsRecord: { businessCode: string | null } }>) => rows.map((row) => row.qmsRecord.businessCode).sort();
    await identityContext.run({ principal, unitTest: true }, async () => {
      const filter = { assigned: "me", year: [String(year)] };
      assert.deepEqual(codes((await getDeviationList(filter)).rows), [`${marker}-DEV1`]);
      assert.deepEqual(codes((await getCapaList(filter)).rows), [`${marker}-CAPA1`]);
      assert.deepEqual(codes((await getChangeControlList(filter)).rows), [`${marker}-CC1`, `${marker}-CC2`]);
      assert.deepEqual(codes((await getComplaintList(filter)).rows), [`${marker}-REC1`]);
      assert.deepEqual(codes((await getAuditList(filter)).rows), [`${marker}-AUD1`]);
      assert.equal((await getDeviationList({ year: [String(year)] })).rows.length, 4, "sin el filtro se ven todos");
    });
    assert.equal(await prisma.changeControl.count({ where: { AND: [assignedWhere.changeControl(me.id), { qmsRecord: { year } }] } }), 2);
    console.log("D-102 OK: panel y listados «Asignadas a mí» con la misma definición de pendiente.");
  } finally {
    await prisma.auditFindingAction.deleteMany({ where: { finding: { audit: { qmsRecordId: { in: ids } } } } });
    await prisma.auditFinding.deleteMany({ where: { audit: { qmsRecordId: { in: ids } } } });
    await prisma.audit.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.complaintDerivedAction.deleteMany({ where: { complaint: { qmsRecordId: { in: ids } } } });
    await prisma.complaint.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.changeControlTaskState.deleteMany({ where: { followup: { changeControl: { qmsRecordId: { in: ids } } } } });
    await prisma.changeControlFollowup.deleteMany({ where: { changeControl: { qmsRecordId: { in: ids } } } });
    await prisma.changeControlTask.deleteMany({ where: { changeControl: { qmsRecordId: { in: ids } } } });
    await prisma.changeControl.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.capaPlannedAction.deleteMany({ where: { capa: { qmsRecordId: { in: ids } } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.deviationCapaPlan.deleteMany({ where: { deviation: { qmsRecordId: { in: ids } } } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exit(1);
});
