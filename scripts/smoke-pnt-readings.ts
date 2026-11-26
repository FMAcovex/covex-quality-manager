// D-141: lecturas de PNT contra la base aislada de pruebas, con datos ficticios. Recorre las reglas del
// servicio: revisiones que se pueden leer, lectores por usuario, departamento y nombre externo, una sola
// lectura pendiente por persona, marcar la propia y la de otros (Garantía de Calidad), relectura, retirada,
// revisión sustituida y lectores anteriores. Deja su PNT en la base de pruebas, como las demás pruebas de PNT.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { manualMaster, nextRevision, qaPrincipal, qaOnly, today, offset } from "../src/modules/controlled-documents/testing/p2c";
import { changeManualRevisionStatus } from "../src/modules/controlled-documents/manual-state/service";
import { addReaders, confirmReading, requestPreviousReaders, requestReread, withdrawReading } from "../src/modules/controlled-documents/readings/service";
import { effectiveReadingState, readingCounts, readerKey } from "../src/modules/controlled-documents/readings/domain";

const QA = "Garantía de Calidad (ficticio)";
async function change(id: string, revisionId: string, targetStatus: string, previousRevisionId: string | null = null) {
  const r = await prisma.controlledDocumentRevision.findUniqueOrThrow({ where: { id: revisionId } });
  const projection = await prisma.controlledRevisionLifecycle.findUnique({ where: { revisionId } });
  return changeManualRevisionStatus(id, revisionId, {
    requestId: randomUUID(), expectedVersion: projection?.version || 0, expectedUpdatedAt: r.updatedAt.toISOString(), targetStatus,
    reason: "Registro manual sintético respaldado por documentación QA",
    ...(targetStatus === "IN_FORCE" ? { effectiveFrom: today, reviewDueAt: offset(365), previousRevisionId } : {}),
  }, qaPrincipal);
}
async function user(name: string, active = true) {
  return prisma.authUser.create({ data: { tenantId: randomUUID(), objectId: randomUUID(), displayName: `${name} (ficticio ${randomUUID().slice(0, 4)})`, email: `${randomUUID()}@lecturas.invalid`, active, authorizedAt: active ? new Date() : null } });
}
const readings = (documentId: string) => prisma.controlledReadingAssignment.findMany({ where: { documentId }, include: { revision: { select: { status: true } } }, orderBy: { assignedAt: "asc" } });

async function main() {
  qaOnly();
  const { master } = await manualMaster();
  const id = master.id, first = master.revisions[0];
  const department = await prisma.department.create({ data: { code: `LT-${Math.floor(Math.random() * 90 + 10)}${randomUUID().slice(0, 2).toUpperCase()}`, name: "Lecturas (ficticio)" } });
  const [ana, bea, inactive] = [await user("Ana"), await user("Bea"), await user("Inactivo", false)];
  await prisma.authUserDepartment.createMany({ data: [{ userId: ana.id, departmentId: department.id }, { userId: bea.id, departmentId: department.id }, { userId: inactive.id, departmentId: department.id }] });
  const due = offset(15);

  // Solo se leen la revisión vigente y la aprobada pendiente de vigencia.
  await assert.rejects(addReaders(id, { revisionId: first.id, userIds: [ana.id], departmentIds: [], externalNames: [], dueDate: due }, QA), /no está vigente ni aprobada/);
  await change(id, first.id, "IN_REVIEW");
  await change(id, first.id, "APPROVED_PENDING_EFFECTIVE");

  // Usuario elegido + su departamento (sin repetirlo y sin el inactivo) + persona externa.
  assert.deepEqual(await addReaders(id, { revisionId: first.id, userIds: [ana.id], departmentIds: [department.id], externalNames: ["Pedro Gómez"], dueDate: due }, QA), { added: 3, skipped: 0 });
  let rows = await readings(id);
  assert.deepEqual(rows.map(r => [r.readerName.split(" (")[0], r.status, r.dueDate.toISOString().slice(0, 10), r.assignedByText]).sort(), [["Ana", "PENDING", due, QA], ["Bea", "PENDING", due, QA], ["Pedro Gómez", "PENDING", due, QA]]);
  await assert.rejects(addReaders(id, { revisionId: first.id, userIds: [ana.id], departmentIds: [], externalNames: [" pedro  GÓMEZ "], dueDate: due }, QA), /ya tienen esta lectura pendiente/);
  await assert.rejects(addReaders(id, { revisionId: first.id, userIds: [inactive.id], departmentIds: [], externalNames: [], dueDate: due }, QA), /no está activo/);
  // Un departamento inactivo no se ofrece y el servidor tampoco lo acepta.
  const closed = await prisma.department.create({ data: { code: `LT-${Math.floor(Math.random() * 90 + 10)}${randomUUID().slice(0, 2).toUpperCase()}`, name: "Lecturas cerrado (ficticio)", isActive: false } });
  await prisma.authUserDepartment.create({ data: { userId: (await user("Dora")).id, departmentId: closed.id } });
  await assert.rejects(addReaders(id, { revisionId: first.id, userIds: [], departmentIds: [closed.id], externalNames: [], dueDate: due }, QA), /no existe o no está activo/);
  // Dos peticiones a la vez para la misma persona: una sola lectura pendiente.
  const carla = await user("Carla");
  const both = await Promise.allSettled([1, 2].map(() => addReaders(id, { revisionId: first.id, userIds: [carla.id], departmentIds: [], externalNames: [], dueDate: due }, QA)));
  assert.deepEqual(both.map(r => r.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(await prisma.controlledReadingAssignment.count({ where: { revisionId: first.id, readerUserId: carla.id, status: "PENDING" } }), 1);

  const byName = (name: string) => rows.find(r => r.readerName.startsWith(name))!;
  // Cada uno marca la suya; no la de otro. Garantía de Calidad marca la de cualquiera (externa incluida).
  await confirmReading(id, { readingId: byName("Ana").id, readOn: today }, { actor: ana.displayName, userId: ana.id, onBehalf: false });
  await assert.rejects(confirmReading(id, { readingId: byName("Bea").id, readOn: today }, { actor: ana.displayName, userId: ana.id, onBehalf: false }), /tus propias lecturas/);
  await assert.rejects(confirmReading(id, { readingId: byName("Pedro").id, readOn: today }, { actor: ana.displayName, userId: ana.id, onBehalf: false }), /tus propias lecturas/);
  await confirmReading(id, { readingId: byName("Pedro").id, readOn: offset(-2) }, { actor: QA, userId: null, onBehalf: true });
  await assert.rejects(confirmReading(id, { readingId: byName("Ana").id, readOn: today }, { actor: ana.displayName, userId: ana.id, onBehalf: false }), /ya no está pendiente/);
  rows = await readings(id);
  assert.deepEqual([byName("Ana").status, byName("Ana").confirmedOnBehalf, byName("Ana").confirmedByText], ["READ", false, ana.displayName]);
  assert.deepEqual([byName("Pedro").status, byName("Pedro").confirmedOnBehalf, byName("Pedro").readOn?.toISOString().slice(0, 10)], ["READ", true, offset(-2)]);

  // Relectura a quien ya leyó (una sola pendiente); retirada con motivo (no se borra).
  await requestReread(id, { readingId: byName("Ana").id, dueDate: offset(7) }, QA);
  await assert.rejects(requestReread(id, { readingId: byName("Ana").id, dueDate: offset(7) }, QA), /ya tiene la lectura pendiente/);
  await assert.rejects(requestReread(id, { readingId: byName("Bea").id, dueDate: offset(7) }, QA), /ya ha leído/);
  await withdrawReading(id, { readingId: byName("Bea").id, reason: "Cambia de puesto (ficticio)" }, QA);
  // Relectura de quien ya no es usuario activo: no se pide (nadie podría marcarla como propia).
  const carlaReading = (await readings(id)).find(r => r.readerUserId === carla.id)!;
  await confirmReading(id, { readingId: carlaReading.id, readOn: today }, { actor: QA, userId: null, onBehalf: true });
  await prisma.authUser.update({ where: { id: carla.id }, data: { active: false } });
  await assert.rejects(requestReread(id, { readingId: carlaReading.id, dueDate: offset(7) }, QA), /ya no es un usuario activo/);
  await prisma.authUser.update({ where: { id: carla.id }, data: { active: true } });
  await assert.rejects(withdrawReading(id, { readingId: byName("Bea").id, reason: "Otra vez" }, QA), /pendiente/);
  rows = await readings(id);
  assert.equal(rows.length, 5, "nada se borra: Ana, Bea, Pedro, Carla y la relectura de Ana");
  assert.equal(readingCounts(rows).get(readerKey(byName("Ana"))), 1);
  assert.deepEqual([byName("Bea").status, byName("Bea").withdrawalReason], ["WITHDRAWN", "Cambia de puesto (ficticio)"]);

  // La revisión entra en vigor: sus lecturas siguen; una revisión nueva la sustituye y lo pendiente decae.
  await change(id, first.id, "IN_FORCE");
  const second = await nextRevision(id, first.id);
  await change(id, second, "IN_FORCE", first.id);
  rows = await readings(id);
  const anaPending = rows.find(r => r.readerUserId === ana.id && r.status === "PENDING")!;
  assert.equal(effectiveReadingState({ status: anaPending.status, revisionStatus: anaPending.revision.status }), "SUPERSEDED");
  await assert.rejects(confirmReading(id, { readingId: anaPending.id, readOn: today }, { actor: ana.displayName, userId: ana.id, onBehalf: false }), /ya no está en lectura/);
  await assert.rejects(requestReread(id, { readingId: byName("Pedro").id, dueDate: offset(7) }, QA), /ya no está en lectura/);
  await assert.rejects(withdrawReading(id, { readingId: anaPending.id, reason: "Sustituida (ficticio)" }, QA), /ya no está en lectura/);

  // Lectores anteriores (sin los retirados) para la revisión nueva.
  assert.deepEqual(await requestPreviousReaders(id, { revisionId: second, dueDate: due }, QA), { added: 3, skipped: 0 });
  const secondReaders = (await prisma.controlledReadingAssignment.findMany({ where: { revisionId: second } })).map(r => r.readerName.split(" (")[0]).sort();
  assert.deepEqual(secondReaders, ["Ana", "Carla", "Pedro Gómez"]);

  // Todo queda en el historial operativo del PNT.
  const changes = await prisma.controlledDocumentChange.count({ where: { documentId: id, reason: "Lecturas del PNT (D-141)" } });
  assert.equal(changes, 8, "alta, alta de Carla, tres confirmaciones, relectura, retirada y lectores anteriores");

  // Una lectura solo se toca desde su propio PNT.
  const { master: other } = await manualMaster();
  await assert.rejects(confirmReading(other.id, { readingId: byName("Carla").id, readOn: today }, { actor: QA, userId: null, onBehalf: true }), /no pertenece a este PNT/);
  await assert.rejects(requestReread(other.id, { readingId: byName("Ana").id, dueDate: due }, QA), /no pertenece a este PNT/);
  await assert.rejects(withdrawReading(other.id, { readingId: anaPending.id, reason: "Otro PNT (ficticio)" }, QA), /no pertenece a este PNT/);

  // Un PNT anulado no admite ningún cambio de lectura.
  const secondPending = await prisma.controlledReadingAssignment.findFirstOrThrow({ where: { revisionId: second, status: "PENDING" } });
  await prisma.controlledDocument.update({ where: { id }, data: { administrativeStatus: "ANNULLED" } });
  await assert.rejects(addReaders(id, { revisionId: second, userIds: [bea.id], departmentIds: [], externalNames: [], dueDate: due }, QA), /anulado/);
  await assert.rejects(requestPreviousReaders(id, { revisionId: second, dueDate: due }, QA), /anulado/);
  await assert.rejects(confirmReading(id, { readingId: secondPending.id, readOn: today }, { actor: QA, userId: null, onBehalf: true }), /anulado/);
  await assert.rejects(requestReread(id, { readingId: byName("Ana").id, dueDate: due }, QA), /anulado/);
  await assert.rejects(withdrawReading(id, { readingId: secondPending.id, reason: "Anulado (ficticio)" }, QA), /anulado/);
  console.log("Lecturas PNT OK: revisiones legibles, lectores por usuario/departamento/externo, una pendiente por persona, confirmación propia y por GC, relectura, retirada, sustitución, lectores anteriores, otro PNT y PNT anulado.");
}

main().then(() => prisma.$disconnect()).catch(async error => { console.error(error); await prisma.$disconnect(); process.exit(1); });
