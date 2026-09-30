import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { allocateDeviationBusinessCode } from "../src/lib/qms/business-code";

const prisma = new PrismaClient();
const year = 2097;
const departmentCode = "GC-00";
const codes = [
  "D/GC-00/001/2097",
  "D/GC-00/002/2097",
  "D/GC-00/003/2097",
  "D/GC-00/004/2097",
];

async function cleanup() {
  await prisma.qmsRecord.deleteMany({
    where: {
      recordType: QmsRecordType.DEVIATION,
      OR: [
        { businessCode: { in: codes } },
        { annulledBusinessCode: { in: codes } },
      ],
      deviation: null,
    },
  });
}

async function main() {
  await cleanup();

  await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.DEVIATION,
      businessCode: codes[0],
      year,
    },
  });
  await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.DEVIATION,
      businessCode: null,
      annulledBusinessCode: codes[1],
      year,
      isActive: false,
    },
  });

  const created = await Promise.all(
    [0, 1].map(() =>
      prisma.$transaction(async (tx) => {
        const code = await allocateDeviationBusinessCode(tx, departmentCode, year);
        await tx.qmsRecord.create({
          data: {
            recordType: QmsRecordType.DEVIATION,
            businessCode: code,
            year,
          },
        });
        return code;
      }),
    ),
  );

  assert.deepEqual([...created].sort(), [codes[2], codes[3]]);
  assert.equal(new Set(created).size, 2);

  const next = await prisma.$transaction((tx) =>
    allocateDeviationBusinessCode(tx, departmentCode, year),
  );
  assert.equal(next, "D/GC-00/005/2097");

  console.log("Deviation automatic code smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
