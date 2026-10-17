import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { QmsRecordType } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { assignOperationalBusinessCode, OperationalBusinessCodeError } from "../src/lib/qms/business-code";
import { getOosList } from "../src/modules/oos/queries";

// D-088, OOS-1: codificación OOS/API|MD/ZZZ/AAAA y listado sobre PostgreSQL.
const year = 2097;
const marker = `OOS-PG-${randomUUID()}`;
const ids: string[] = [];

async function open(area: "API" | "MD", values: Record<string, unknown> = {}) {
  return prisma.$transaction(async (tx) => {
    const businessCode = await assignOperationalBusinessCode(tx, { recordType: QmsRecordType.OOS, year, oosArea: area });
    const record = await tx.qmsRecord.create({ data: { recordType: QmsRecordType.OOS, businessCode, year } });
    await tx.oosRecord.create({ data: { qmsRecordId: record.id, status: "OPEN", area, materialName: marker, lotNumber: `${marker}-${area}`, issueDate: new Date(`${year}-01-15`), ...values } });
    return record;
  });
}

async function main() {
  if (process.env.APP_ENV !== "test") throw new Error("El smoke de OOS requiere una base ficticia con APP_ENV=test.");
  try {
    // Aperturas concurrentes: correlativos únicos y sin huecos, independientes por área.
    const created = await Promise.all([...Array.from({ length: 6 }, () => open("API")), ...Array.from({ length: 3 }, () => open("MD"))]);
    ids.push(...created.map((record) => record.id));
    const codes = created.map((record) => record.businessCode).sort();
    assert.deepEqual(codes, [
      ...[1, 2, 3, 4, 5, 6].map((n) => `OOS/API/00${n}/${year}`),
      ...[1, 2, 3].map((n) => `OOS/MD/00${n}/${year}`),
    ]);

    // Un código anulado sigue reservado y no se reutiliza.
    const md3 = created.find((record) => record.businessCode === `OOS/MD/003/${year}`)!;
    await prisma.qmsRecord.update({ where: { id: md3.id }, data: { isActive: false, businessCode: null, annulledBusinessCode: `OOS/MD/003/${year}`, annulledAt: new Date(), annulledReason: "Prueba de reserva" } });
    const md4 = await open("MD", { phaseIDisposition: "FULL_SCALE" });
    ids.push(md4.id);
    assert.equal(md4.businessCode, `OOS/MD/004/${year}`);

    // Un código pedido a mano debe ser de su área y año, y no estar usado.
    await assert.rejects(prisma.$transaction((tx) => assignOperationalBusinessCode(tx, { recordType: QmsRecordType.OOS, year, oosArea: "API", requestedCode: `OOS/MD/009/${year}` })), OperationalBusinessCodeError);
    await assert.rejects(prisma.$transaction((tx) => assignOperationalBusinessCode(tx, { recordType: QmsRecordType.OOS, year, oosArea: "MD", requestedCode: `OOS/MD/003/${year}` })), OperationalBusinessCodeError);
    assert.equal(await prisma.$transaction((tx) => assignOperationalBusinessCode(tx, { recordType: QmsRecordType.OOS, year, oosArea: "API", requestedCode: `OOS/API/020/${year}` })), `OOS/API/020/${year}`);

    // Cierres por fase y filtros del listado sobre SQL.
    const api1 = created.find((record) => record.businessCode === `OOS/API/001/${year}`)!;
    await prisma.oosRecord.update({ where: { qmsRecordId: api1.id }, data: { status: "CLOSED", phaseIDisposition: "LAB_ERROR", investigationResult: "INVALIDATED", closedAt: new Date(`${year}-01-20`) } });
    const byMarker = { q: marker, year: [String(year)] };
    assert.equal((await getOosList(byMarker)).count, 9);
    assert.equal((await getOosList({ ...byMarker, administrative: "ALL" })).count, 10);
    assert.equal((await getOosList({ ...byMarker, area: ["MD"] })).count, 3);
    assert.equal((await getOosList({ ...byMarker, phase: "II" })).count, 1);
    assert.equal((await getOosList({ ...byMarker, phase: "I" })).count, 8);
    assert.equal((await getOosList({ ...byMarker, status: ["CLOSED"], result: ["INVALIDATED"] })).count, 1);
    assert.equal((await getOosList({ q: `OOS/MD/003/${year}`, administrative: "ANNULLED" })).count, 1);
    console.log("OOS PG OK: 9 aperturas concurrentes con correlativos API y MD independientes, código anulado reservado, códigos pedidos validados por área y filtros de listado (área, fase, estado, resultado y anulados).");
  } finally {
    await prisma.changeHistory.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.oosRecord.deleteMany({ where: { qmsRecordId: { in: ids } } });
    await prisma.qmsRecord.deleteMany({ where: { id: { in: ids } } });
  }
}

main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
