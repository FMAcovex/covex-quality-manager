import { Prisma, QmsRecordType } from "@prisma/client";

type Tx = Prisma.TransactionClient;
type QmsRecordReader = Pick<Tx, "qmsRecord">;

export class DeviationBusinessCodeError extends Error {
  constructor(
    public readonly reason: "INVALID_FORMAT" | "ALREADY_USED" | "EXHAUSTED",
    message: string,
  ) {
    super(message);
    this.name = "DeviationBusinessCodeError";
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
}

export function deviationCodePrefix(departmentCode: string) {
  return `D/${departmentCode}/`;
}

export function buildDeviationCode(departmentCode: string, sequence: number, year: number) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new DeviationBusinessCodeError(
      "INVALID_FORMAT",
      "El correlativo de desviaciones debe estar entre 001 y 999.",
    );
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

async function usedDeviationCodes(
  db: QmsRecordReader,
  departmentCode: string,
) {
  const prefix = deviationCodePrefix(departmentCode);
  return db.qmsRecord.findMany({
    where: {
      recordType: QmsRecordType.DEVIATION,
      OR: [
        { businessCode: { startsWith: prefix } },
        { annulledBusinessCode: { startsWith: prefix } },
      ],
    },
    select: {
      id: true,
      businessCode: true,
      annulledBusinessCode: true,
    },
  });
}

function nextSequenceFromRecords(
  records: Awaited<ReturnType<typeof usedDeviationCodes>>,
  departmentCode: string,
  year: number,
) {
  let maxSequence = 0;
  for (const record of records) {
    for (const candidate of [record.businessCode, record.annulledBusinessCode]) {
      const sequence = extractDeviationSequence(candidate, departmentCode, year);
      if (sequence && sequence > maxSequence) maxSequence = sequence;
    }
  }
  return maxSequence + 1;
}

export async function suggestDeviationBusinessCode(
  db: QmsRecordReader,
  departmentCode: string,
  year: number,
) {
  const records = await usedDeviationCodes(db, departmentCode);
  const nextSequence = nextSequenceFromRecords(records, departmentCode, year);
  if (nextSequence > 999) {
    throw new DeviationBusinessCodeError(
      "EXHAUSTED",
      `Se ha agotado el correlativo de desviaciones para ${departmentCode} en ${year}.`,
    );
  }
  return buildDeviationCode(departmentCode, nextSequence, year);
}

async function lockDeviationSequence(
  tx: Tx,
  departmentCode: string,
  year: number,
) {
  const lockKey = `DEVIATION:${departmentCode}:${year}`;
  await tx.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${lockKey}))) AS q`,
  );
}

export async function assignDeviationBusinessCode(
  tx: Tx,
  {
    departmentCode,
    year,
    requestedCode,
    excludeQmsRecordId,
  }: {
    departmentCode: string;
    year: number;
    requestedCode?: string | null;
    excludeQmsRecordId?: string;
  },
) {
  await lockDeviationSequence(tx, departmentCode, year);

  const normalizedRequested = requestedCode?.trim() || null;
  if (normalizedRequested) {
    if (extractDeviationSequence(normalizedRequested, departmentCode, year) === null) {
      throw new DeviationBusinessCodeError(
        "INVALID_FORMAT",
        `La codificación debe seguir el formato D/${departmentCode}/ZZZ/${year}.`,
      );
    }

    const duplicate = await tx.qmsRecord.findFirst({
      where: {
        recordType: QmsRecordType.DEVIATION,
        ...(excludeQmsRecordId ? { id: { not: excludeQmsRecordId } } : {}),
        OR: [
          { businessCode: normalizedRequested },
          { annulledBusinessCode: normalizedRequested },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new DeviationBusinessCodeError(
        "ALREADY_USED",
        "Esa codificación ya ha sido utilizada por otra desviación, incluida la numeración histórica anulada.",
      );
    }
    return normalizedRequested;
  }

  return suggestDeviationBusinessCode(tx, departmentCode, year);
}

// Compatibilidad interna con el nombre inicial de D3.
export async function allocateDeviationBusinessCode(
  tx: Tx,
  departmentCode: string,
  year: number,
) {
  return assignDeviationBusinessCode(tx, { departmentCode, year });
}
