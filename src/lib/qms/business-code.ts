import { Prisma, QmsRecordType } from "@prisma/client";

type Tx = Prisma.TransactionClient;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
}

export function deviationCodePrefix(departmentCode: string) {
  return `D/${departmentCode}/`;
}

export function buildDeviationCode(departmentCode: string, sequence: number, year: number) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new Error("El correlativo de desviaciones debe estar entre 001 y 999.");
  }
  return `${deviationCodePrefix(departmentCode)}${String(sequence).padStart(3, "0")}/${year}`;
}

export function extractDeviationSequence(
  code: string | null | undefined,
  departmentCode: string,
  year: number,
) {
  if (!code) return null;
  const pattern = new RegExp(
    `^D/${escapeRegex(departmentCode)}/(\\d{3})/${year}$`,
  );
  const match = pattern.exec(code.trim());
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isInteger(sequence) && sequence >= 1 && sequence <= 999
    ? sequence
    : null;
}

export async function allocateDeviationBusinessCode(
  tx: Tx,
  departmentCode: string,
  year: number,
) {
  const lockKey = `DEVIATION:${departmentCode}:${year}`;
  await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

  const prefix = deviationCodePrefix(departmentCode);
  const records = await tx.qmsRecord.findMany({
    where: {
      recordType: QmsRecordType.DEVIATION,
      OR: [
        { businessCode: { startsWith: prefix } },
        { annulledBusinessCode: { startsWith: prefix } },
      ],
    },
    select: {
      businessCode: true,
      annulledBusinessCode: true,
    },
  });

  let maxSequence = 0;
  for (const record of records) {
    for (const candidate of [record.businessCode, record.annulledBusinessCode]) {
      const sequence = extractDeviationSequence(candidate, departmentCode, year);
      if (sequence && sequence > maxSequence) maxSequence = sequence;
    }
  }

  const nextSequence = maxSequence + 1;
  if (nextSequence > 999) {
    throw new Error(
      `Se ha agotado el correlativo de desviaciones para ${departmentCode} en ${year}.`,
    );
  }

  return buildDeviationCode(departmentCode, nextSequence, year);
}
