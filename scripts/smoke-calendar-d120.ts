import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { getCalendarItems } from "../src/modules/dashboard/calendar-query";
import { calendarRange, type CalendarQuery } from "../src/modules/dashboard/calendar-domain";
import { getDashboardData } from "../src/modules/dashboard/queries";

// D-120: el calendario usa las mismas reglas de pendiente que el panel y «Mis tareas».
const marker = "D120-" + randomUUID().slice(0, 8);
const year = 2097;
const day = (d: number) => new Date(Date.UTC(year, 2, d));
const recordIds: string[] = [];
const documentIds: string[] = [];

async function record(recordType: "DEVIATION" | "CAPA" | "CHANGE_CONTROL" | "AUDIT", suffix: string) {
  const row = await prisma.qmsRecord.create({ data: { recordType, businessCode: `${marker}-${suffix}`, year } });
  recordIds.push(row.id);
  return row.id;
}

async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("El smoke D-120 requiere una base ficticia con APP_ENV=test.");
  const [me, other] = await prisma.authUser.findMany({ where: { active: true, authorizedAt: { not: null } }, orderBy: { id: "asc" }, take: 2 });
  assert(me && other, "Hacen falta dos usuarios activos (auth:fixtures).");
  const [depA, depB] = await prisma.department.findMany({ where: { isActive: true, code: { contains: "-" } }, orderBy: { code: "asc" }, take: 2 });
  assert(depA && depB, "Hacen falta dos departamentos.");
  try {
    // Desviación abierta con seguimiento el 10/03; una cerrada con seguimiento no cuenta.
    const devOpen = await prisma.deviation.create({ data: { qmsRecordId: await record("DEVIATION", "DEV1"), status: "OPEN", provenance: "OTHER", departmentId: depA.id } });
    await prisma.deviationFollowup.create({ data: { deviationId: devOpen.id, followupDate: day(1), completedByText: "QA", comment: "Seguimiento", nextFollowupDate: day(10) } });
    const devClosed = await prisma.deviation.create({ data: { qmsRecordId: await record("DEVIATION", "DEV2"), status: "CLOSED", provenance: "OTHER", departmentId: depA.id } });
    await prisma.deviationFollowup.create({ data: { deviationId: devClosed.id, followupDate: day(1), completedByText: "QA", comment: "Cerrada", nextFollowupDate: day(11) } });
    // CAPA abierta: acción a mi cargo el 12/03, acción de otro el 13/03 y una sin fecha.
    const capa = await prisma.capa.create({ data: { qmsRecordId: await record("CAPA", "CAPA1"), status: "OPEN", actionType: "CORRECTIVE", departmentId: depA.id } });
    await prisma.capaPlannedAction.create({ data: { capaId: capa.id, description: "Mía", responsibleUserId: me.id, plannedExecutionDate: day(12) } });
    await prisma.capaPlannedAction.create({ data: { capaId: capa.id, description: "De otro", responsibleUserId: other.id, plannedExecutionDate: day(13) } });
    await prisma.capaPlannedAction.create({ data: { capaId: capa.id, description: "Mía sin fecha", responsibleUserId: me.id } });
    // Cambio abierto sin ejecutar con ejecución prevista el 15/03, en otro departamento.
    const change = await prisma.changeControl.create({ data: { qmsRecordId: await record("CHANGE_CONTROL", "CC1"), finalStatus: "OPEN", executionStatus: "NOT_EXECUTED", plannedImplementationDate: day(15), departmentId: depB.id } });
    // Auditoría planificada el 20/03 sin realizar; otra ya realizada no cuenta.
    const planned = await prisma.audit.create({ data: { qmsRecordId: await record("AUDIT", "AUD1"), status: "OPEN", plannedDate: day(20), departments: { create: { departmentId: depA.id, departmentCodeSnapshot: depA.code, departmentNameSnapshot: depA.name } } } });
    await prisma.audit.create({ data: { qmsRecordId: await record("AUDIT", "AUD2"), status: "OPEN", plannedDate: day(21), performedDate: day(21) } });
    // PNT vigente: revisión de la revisión el 01/03 pero su ciclo de vida dice 25/03 (manda el ciclo de vida).
    const occupied = new Set((await prisma.controlledDocument.findMany({ where: { baseCode: { startsWith: depA.code + "/" } }, select: { baseCode: true } })).map((row) => row.baseCode));
    const pntCode = Array.from({ length: 1000 }, (_, i) => `${depA.code}/${String(999 - i).padStart(3, "0")}`).find((code) => !occupied.has(code))!;
    const pnt = await prisma.controlledDocument.create({ data: { baseCode: pntCode, title: marker, documentType: "PNT", administrativeStatus: "ACTIVE", departmentId: depA.id, createdByText: "Prueba D-120" } });
    documentIds.push(pnt.id);
    const revision = await prisma.controlledDocumentRevision.create({ data: { documentId: pnt.id, revisionCode: "00", status: "IN_FORCE", registeredByText: "Prueba D-120", effectiveFrom: day(1), reviewDueAt: day(1) } });
    await prisma.controlledRevisionLifecycle.create({ data: { revisionId: revision.id, documentId: pnt.id, reviewDueAt: day(25) } });

    const asOf = day(5);
    const query = (changes: Partial<CalendarQuery> = {}): CalendarQuery => ({ view: "month", anchor: day(1), module: "ALL", department: "", scope: "all", ...changes });
    const range = calendarRange("month", day(1));
    const mine = <T extends { code: string }>(items: T[]) => items.filter((item) => item.code.startsWith(marker) || item.code === pntCode);
    const all = await getCalendarItems(query(), range, me.id, asOf);
    const entries = mine(all.items).map((item) => [item.key, item.code, item.label, item.date.toISOString().slice(0, 10)]);
    assert.deepEqual(entries.sort(), [
      [`AUD-P-${planned.id}`, `${marker}-AUD1`, "Auditoría planificada", `${year}-03-20`],
      [`CAPA-A-${(await prisma.capaPlannedAction.findFirstOrThrow({ where: { capaId: capa.id, description: "De otro" } })).id}`, `${marker}-CAPA1`, "Acción propuesta", `${year}-03-13`],
      [`CAPA-A-${(await prisma.capaPlannedAction.findFirstOrThrow({ where: { capaId: capa.id, description: "Mía" } })).id}`, `${marker}-CAPA1`, "Acción propuesta", `${year}-03-12`],
      [`CC-E-${change.id}`, `${marker}-CC1`, "Ejecución de cambio", `${year}-03-15`],
      [`DEV-F-${devOpen.id}`, `${marker}-DEV1`, "Próximo seguimiento", `${year}-03-10`],
      [`PNT-R-${pnt.id}`, pntCode, "Revisión documental", `${year}-03-25`],
    ].sort());
    assert(mine(all.items).every((item) => !item.overdue), "Nada vence antes del 05/03");
    assert((await getCalendarItems(query(), range, me.id, day(14))).items.find((item) => item.key === `DEV-F-${devOpen.id}`)?.overdue, "El 14/03 el seguimiento del 10/03 está vencido");

    // Filtros: departamento y módulo.
    const depOnly = mine((await getCalendarItems(query({ department: depB.id }), range, me.id, asOf)).items);
    assert.deepEqual(depOnly.map((item) => item.code), [`${marker}-CC1`]);
    const pntOnly = mine((await getCalendarItems(query({ module: "PNT" }), range, me.id, asOf)).items);
    assert.deepEqual(pntOnly.map((item) => item.code), [pntCode]);
    // Otro mes no muestra nada de marzo.
    assert.equal(mine((await getCalendarItems(query({ anchor: new Date(Date.UTC(year, 5, 1)) }), calendarRange("month", new Date(Date.UTC(year, 5, 1))), me.id, asOf)).items).length, 0);

    // «Solo mis tareas»: solo lo vinculado a mí con fecha; lo que no tiene fecha se cuenta aparte.
    const own = await getCalendarItems(query({ scope: "mine" }), range, me.id, asOf);
    assert.deepEqual(mine(own.items).map((item) => item.date.toISOString().slice(0, 10)), [`${year}-03-12`]);
    assert(own.undated >= 1, "La acción sin fecha se cuenta como no visible");

    // Mismas claves que el panel para los plazos que comparten regla.
    const dashboard = await getDashboardData({ year: null, department: depA.id, module: "ALL", state: "ALL", taskView: "all", page: 1, asOf });
    const dashboardKeys = new Set(dashboard.tasks.map((task) => task.key));
    for (const key of [`DEV-F-${devOpen.id}`, `PNT-R-${pnt.id}`]) {
      assert(dashboardKeys.has(key), "El panel muestra " + key);
      assert(all.items.some((item) => item.key === key), "El calendario muestra " + key);
    }
    console.log("D-120 OK: calendario con las reglas del panel y de «Mis tareas», filtros, vencidas y «Solo mis tareas».");
  } finally {
    await prisma.controlledRevisionLifecycle.deleteMany({ where: { documentId: { in: documentIds } } });
    await prisma.controlledDocumentRevision.deleteMany({ where: { documentId: { in: documentIds } } });
    await prisma.controlledDocument.deleteMany({ where: { id: { in: documentIds } } });
    await prisma.auditDepartment.deleteMany({ where: { audit: { qmsRecordId: { in: recordIds } } } });
    await prisma.audit.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.changeControl.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.capaPlannedAction.deleteMany({ where: { capa: { qmsRecordId: { in: recordIds } } } });
    await prisma.capa.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.deviationFollowup.deleteMany({ where: { deviation: { qmsRecordId: { in: recordIds } } } });
    await prisma.deviation.deleteMany({ where: { qmsRecordId: { in: recordIds } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: recordIds } } });
  }
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exit(1);
});
