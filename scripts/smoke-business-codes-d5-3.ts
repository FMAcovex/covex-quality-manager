import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import {
  assignOperationalBusinessCode,
  suggestOperationalBusinessCode,
} from "../src/lib/qms/business-code";

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
    assert.equal(capaSuggestion, "AC/GC-00/002/2097");

    const capa2 = await createWithAssignedCode({
      recordType: QmsRecordType.CAPA,
      year,
      departmentCode: "GC-00",
      actionType: "CORRECTIVE",
      requestedCode: capaSuggestion,
    });
    createdIds.push(capa2.record.id);
    assert.equal(capa2.code, "AC/GC-00/002/2097");

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
      /ya ha sido utilizada/,
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
