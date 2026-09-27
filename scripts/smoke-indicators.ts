import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import {
  buildYearMetrics,
  type AnalyticsRow,
} from "../src/modules/deviations/analytics/domain";

const prisma = new PrismaClient();

async function createDeviation(input: {
  code: string;
  opening: string;
  closing?: string;
  classification?: "CRITICAL" | "MAJOR" | "MINOR";
  recurrent?: "YES" | "NO";
  affectsPt?: "YES" | "NO";
  capaRequired?: boolean;
}) {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });
  const qmsRecord = await prisma.qmsRecord.create({
    data: {
      recordType: QmsRecordType.DEVIATION,
      businessCode: input.code,
      year: new Date(input.opening).getUTCFullYear(),
    },
  });
  return prisma.deviation.create({
    data: {
      qmsRecordId: qmsRecord.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      issueDate: new Date(input.opening),
      closedAt: input.closing ? new Date(input.closing) : null,
      status: input.closing ? "CLOSED" : "OPEN",
      classification: input.classification ?? "MINOR",
      recurrentRootCause: input.recurrent ?? "NO",
      affectsFinishedProduct: input.affectsPt ?? "NO",
      provenance: "CI KPI smoke",
      capaRequired: input.capaRequired ?? false,
      whatHappened: "Registro ficticio para validar indicadores.",
      createdByText: "CI",
    },
    include: {
      qmsRecord: true,
      capaPlans: { select: { id: true } },
    },
  });
}

async function main() {
  await createDeviation({
    code: "D/KPI/001/2025",
    opening: "2025-12-20T00:00:00Z",
    closing: "2026-01-10T00:00:00Z",
    classification: "MAJOR",
    recurrent: "YES",
    affectsPt: "NO",
    capaRequired: true,
  });
  await createDeviation({
    code: "D/KPI/001/2026",
    opening: "2026-02-01T00:00:00Z",
    closing: "2026-03-05T00:00:00Z",
    classification: "MINOR",
    recurrent: "NO",
    affectsPt: "YES",
  });
  await createDeviation({
    code: "D/KPI/002/2026",
    opening: "2026-04-01T00:00:00Z",
    classification: "CRITICAL",
    recurrent: "NO",
    affectsPt: "NO",
  });

  const records = await prisma.deviation.findMany({
    where: { provenance: "CI KPI smoke" },
    select: {
      issueDate: true,
      closedAt: true,
      status: true,
      classification: true,
      recurrentRootCause: true,
      affectsFinishedProduct: true,
      provenance: true,
      departmentCodeSnapshot: true,
      departmentNameSnapshot: true,
      capaRequired: true,
      qmsRecord: { select: { year: true } },
      capaPlans: { select: { id: true } },
    },
  });

  const rows: AnalyticsRow[] = records.map((record) => ({
    openingYear: record.qmsRecord.year,
    issueDate: record.issueDate,
    closedAt: record.closedAt,
    status: record.status,
    classification: record.classification,
    recurrentRootCause: record.recurrentRootCause,
    affectsFinishedProduct: record.affectsFinishedProduct,
    provenance: record.provenance,
    departmentCode: record.departmentCodeSnapshot,
    departmentName: record.departmentNameSnapshot,
    capaRequired: record.capaRequired,
    capaCount: record.capaPlans.length,
  }));

  const y2025 = buildYearMetrics(rows, 2025);
  const y2026 = buildYearMetrics(rows, 2026);

  assert.equal(y2025.total, 1);
  assert.equal(y2025.withCapa, 1);
  assert.equal(y2025.recurrence.rate, 100);
  assert.equal(y2025.closure.total, 0);

  assert.equal(y2026.total, 2);
  assert.equal(y2026.critical, 1);
  assert.equal(y2026.openCurrent, 1);
  assert.equal(y2026.affectsProduct.rate, 50);

  // Two closures belong to 2026: one took 21 days and one 32 days.
  assert.equal(y2026.closure.total, 2);
  assert.equal(y2026.closure.within30, 1);
  assert.equal(y2026.closure.rate, 50);
  assert.equal(y2026.closure.medianDays, 26.5);

  console.log("Deviation indicators PostgreSQL smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
