import { PrismaClient } from "@prisma/client";
import {
  serializeCapaVersion,
  serializeDeviationVersion,
  snapshotJson,
  versionLabel,
} from "../src/lib/qms/versioning";

const prisma = new PrismaClient();

async function backfillDeviations() {
  const rows = await prisma.deviation.findMany({
    where: { qmsRecord: { versions: { none: {} } } },
    include: {
      qmsRecord: true,
      immediateActions: { orderBy: { sortOrder: "asc" } },
      followups: { orderBy: [{ followupDate: "asc" }, { createdAt: "asc" }] },
      capaPlans: {
        orderBy: { createdAt: "asc" },
        include: { linkedCapaRecord: true },
      },
      formVersion: true,
      anexoIIITemplateVersion: true,
    },
  });

  for (const row of rows) {
    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: row.qmsRecordId,
        sequenceNumber: 0,
        kind: "HISTORICAL_STATE",
        snapshot: snapshotJson(serializeDeviationVersion(row)),
        reason:
          "Baseline histórico al activar Hito 6.1; no reconstruye reaperturas o revisiones anteriores no almacenadas",
        createdByText: "Migración Hito 6.1",
        source: "SYSTEM",
      },
    });
  }
  return rows.length;
}

async function backfillCapas() {
  const rows = await prisma.capa.findMany({
    where: { qmsRecord: { versions: { none: {} } } },
    include: {
      qmsRecord: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      actionFollowups: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }] },
      formVersion: true,
      annexIIITemplateVersion: true,
    },
  });

  for (const row of rows) {
    const sequenceNumber = Math.max(
      0,
      ...row.followups.map((item) => item.sequenceNumber),
    );
    await prisma.qmsRecordVersion.create({
      data: {
        qmsRecordId: row.qmsRecordId,
        sequenceNumber,
        kind: "HISTORICAL_STATE",
        snapshot: snapshotJson(serializeCapaVersion(row)),
        reason:
          "Baseline histórico al activar Hito 6.1; las versiones previas no se reconstruyen si no existía snapshot",
        createdByText: "Migración Hito 6.1",
        source: "SYSTEM",
      },
    });
    console.log(
      `${row.qmsRecord.businessCode ?? row.id}: baseline ${versionLabel(sequenceNumber)}`,
    );
  }
  return rows.length;
}

async function main() {
  const [deviations, capas] = await Promise.all([
    backfillDeviations(),
    backfillCapas(),
  ]);
  console.log(
    `Backfill Hito 6.1 completado: ${deviations} desviaciones y ${capas} CAPA.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
