import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import {
  assignOperationalBusinessCode,
  suggestOperationalBusinessCode,
} from "../src/lib/qms/business-code";
import { changeAdministrativeStatus } from "../src/lib/qms/administrative-status";

const prisma = new PrismaClient();

async function createWithAssignedCode(input: {
  recordType: QmsRecordType;
  year: number;
  departmentCode?: string;
  actionType?: "CORRECTIVE" | "PREVENTIVE";
  complaintType?: "CUSTOMER" | "PROVIDER";
  requestedCode?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const code = await assignOperationalBusinessCode(tx, input);
    const record = await tx.qmsRecord.create({
      data: {
        recordType: input.recordType,
        businessCode: code,
        year: input.year,
      },
    });
    return { record, code };
  });
}

async function main() {
  const year = 2097;
  const createdIds: string[] = [];

  try {
    const capa1 = await createWithAssignedCode({
      recordType: QmsRecordType.CAPA,
      year,
      departmentCode: "GC-00",
      actionType: "CORRECTIVE",
    });
    createdIds.push(capa1.record.id);
    assert.equal(capa1.code, "AC/GC-00/001/2097");

    await prisma.qmsRecord.update({
      where: { id: capa1.record.id },
      data: {
        annulledBusinessCode: capa1.code,
        businessCode: null,
        isActive: false,
      },
    });

    const capaSuggestion = await suggestOperationalBusinessCode(prisma, {
      recordType: QmsRecordType.CAPA,
      year,
      departmentCode: "GC-00",
      actionType: "CORRECTIVE",
    });
    // D-133: el código anulado queda libre y, al ser el último, se vuelve a sugerir.
    assert.equal(capaSuggestion, "AC/GC-00/001/2097");

    const capa2 = await createWithAssignedCode({
      recordType: QmsRecordType.CAPA,
      year,
      departmentCode: "GC-00",
      actionType: "CORRECTIVE",
      requestedCode: capaSuggestion,
    });
    createdIds.push(capa2.record.id);
    assert.equal(capa2.code, "AC/GC-00/001/2097");

    // La CAPA anulada no se puede reactivar: su código lo tiene ya otra.
    await assert.rejects(
      () => changeAdministrativeStatus(capa1.record.id, "REACTIVATE", "Prueba de reactivación", "Smoke D5.3"),
      /reutilizada/,
    );

    // Un anulado intermedio no se sugiere, pero se puede escribir a mano.
    const capaContext = { recordType: QmsRecordType.CAPA, year, departmentCode: "GC-00", actionType: "CORRECTIVE" as const };
    const capa3 = await createWithAssignedCode(capaContext);
    const capa4 = await createWithAssignedCode(capaContext);
    createdIds.push(capa3.record.id, capa4.record.id);
    assert.deepEqual([capa3.code, capa4.code], ["AC/GC-00/002/2097", "AC/GC-00/003/2097"]);
    await prisma.qmsRecord.update({ where: { id: capa3.record.id }, data: { annulledBusinessCode: capa3.code, businessCode: null, isActive: false } });
    assert.equal(await suggestOperationalBusinessCode(prisma, capaContext), "AC/GC-00/004/2097");
    const capa5 = await createWithAssignedCode({ ...capaContext, requestedCode: "AC/GC-00/002/2097" });
    createdIds.push(capa5.record.id);
    assert.equal(capa5.code, "AC/GC-00/002/2097");

    const change = await createWithAssignedCode({
      recordType: QmsRecordType.CHANGE_CONTROL,
      year,
      departmentCode: "GC-00",
    });
    createdIds.push(change.record.id);
    assert.equal(change.code, "C/GC-00/001/2097");

    const complaintCustomer = await createWithAssignedCode({
      recordType: QmsRecordType.COMPLAINT,
      year,
      complaintType: "CUSTOMER",
    });
    createdIds.push(complaintCustomer.record.id);
    assert.equal(complaintCustomer.code, "R/C/001/2097");

    const complaintProvider = await createWithAssignedCode({
      recordType: QmsRecordType.COMPLAINT,
      year,
      complaintType: "PROVIDER",
    });
    createdIds.push(complaintProvider.record.id);
    assert.equal(complaintProvider.code, "R/P/001/2097");

    const returned = await createWithAssignedCode({
      recordType: QmsRecordType.RETURN,
      year,
      departmentCode: "LG-30",
    });
    createdIds.push(returned.record.id);
    assert.equal(returned.code, "DEV/LG-30/001/2097");

    await assert.rejects(
      () =>
        createWithAssignedCode({
          recordType: QmsRecordType.CAPA,
          year,
          departmentCode: "GC-00",
          actionType: "CORRECTIVE",
          requestedCode: "AC/GC-00/001/2097",
        }),
      /ya la tiene otro expediente/,
    );

    await assert.rejects(
      () =>
        createWithAssignedCode({
          recordType: QmsRecordType.RETURN,
          year,
          departmentCode: "LG-30",
          requestedCode: "DEV/GC-00/999/2097",
        }),
      /formato/,
    );

    console.log("D5.3 controlled business-code smoke passed.");
  } finally {
    await prisma.qmsRecord.deleteMany({ where: { id: { in: createdIds } } });
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
