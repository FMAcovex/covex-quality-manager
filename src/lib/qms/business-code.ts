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


export class OperationalBusinessCodeError extends Error {
  constructor(
    public readonly reason: "INVALID_FORMAT" | "ALREADY_USED" | "EXHAUSTED",
    message: string,
  ) {
    super(message);
    this.name = "OperationalBusinessCodeError";
  }
}

export type OperationalBusinessCodeContext = {
  recordType: QmsRecordType;
  year: number;
  departmentCode?: string | null;
  actionType?: "CORRECTIVE" | "PREVENTIVE" | null;
  complaintType?: "CUSTOMER" | "PROVIDER" | null;
  auditType?: "INTERNAL" | "EXTERNAL" | null;
  auditScenario?: "INTERNAL_COVEX" | "INTERNAL_CONTRACTED" | "SUPPLIER" | "CLIENT" | "AUTHORITY" | null;
  entityCode?: string | null;
};

function assertOperationalYear(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new OperationalBusinessCodeError(
      "INVALID_FORMAT",
      "El año de la codificación no es válido.",
    );
  }
}

export function operationalBusinessCodePrefix(
  context: OperationalBusinessCodeContext,
) {
  assertOperationalYear(context.year);

  if (context.recordType === QmsRecordType.AUDIT) {
    if (context.auditType === "INTERNAL" && ["INTERNAL_COVEX", "INTERNAL_CONTRACTED"].includes(context.auditScenario ?? "")) {
      if (!context.departmentCode) throw new OperationalBusinessCodeError("INVALID_FORMAT", "Selecciona el área de referencia para codificación.");
      return `AI/${context.departmentCode}/`;
    }
    if (context.auditType === "EXTERNAL" && context.auditScenario === "SUPPLIER") {
      if (!context.entityCode || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(context.entityCode)) throw new OperationalBusinessCodeError("INVALID_FORMAT", "Indica un código de entidad válido, sin espacios ni barras.");
      return `AE/${context.entityCode}/`;
    }
    throw new OperationalBusinessCodeError("INVALID_FORMAT", "Este escenario se identifica por UUID QMS y referencia externa, sin serie oficial generada.");
  }

  if (context.recordType === QmsRecordType.CAPA) {
    if (!context.departmentCode) {
      throw new OperationalBusinessCodeError(
        "INVALID_FORMAT",
        "La CAPA necesita un departamento para calcular su codificación.",
      );
    }
    if (context.actionType !== "CORRECTIVE" && context.actionType !== "PREVENTIVE") {
      throw new OperationalBusinessCodeError(
        "INVALID_FORMAT",
        "La CAPA necesita indicar si es correctiva o preventiva.",
      );
    }
    const prefix = context.actionType === "PREVENTIVE" ? "AP" : "AC";
    return `${prefix}/${context.departmentCode}/`;
  }

  if (context.recordType === QmsRecordType.CHANGE_CONTROL) {
    if (!context.departmentCode) {
      throw new OperationalBusinessCodeError(
        "INVALID_FORMAT",
        "El Control de Cambio necesita un departamento para calcular su codificación.",
      );
    }
    return `C/${context.departmentCode}/`;
  }

  if (context.recordType === QmsRecordType.COMPLAINT) {
    if (context.complaintType !== "CUSTOMER" && context.complaintType !== "PROVIDER") {
      throw new OperationalBusinessCodeError(
        "INVALID_FORMAT",
        "La reclamación necesita indicar si es de cliente o a proveedor.",
      );
    }
    return `R/${context.complaintType === "PROVIDER" ? "P" : "C"}/`;
  }

  if (context.recordType === QmsRecordType.RETURN) {
    if (!context.departmentCode) {
      throw new OperationalBusinessCodeError(
        "INVALID_FORMAT",
        "La devolución necesita un área/almacén para calcular su codificación.",
      );
    }
    return `DEV/${context.departmentCode}/`;
  }

  throw new OperationalBusinessCodeError(
    "INVALID_FORMAT",
    "Este módulo no utiliza la codificación transversal de D5.3.",
  );
}

export function operationalBusinessCodeFormat(
  context: OperationalBusinessCodeContext,
) {
  return `${operationalBusinessCodePrefix(context)}${context.recordType === "AUDIT" ? "YY" : "ZZZ"}/${context.year}`;
}

export function buildOperationalBusinessCode(
  context: OperationalBusinessCodeContext,
  sequence: number,
) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > (context.recordType === "AUDIT" ? 99 : 999)) {
    throw new OperationalBusinessCodeError(
      "INVALID_FORMAT",
      context.recordType === "AUDIT" ? "El correlativo debe estar entre 01 y 99." : "El correlativo debe estar entre 001 y 999.",
    );
  }
  return `${operationalBusinessCodePrefix(context)}${String(sequence).padStart(context.recordType === "AUDIT" ? 2 : 3, "0")}/${context.year}`;
}

export function extractOperationalBusinessCodeSequence(
  code: string | null | undefined,
  context: OperationalBusinessCodeContext,
) {
  if (!code) return null;
  const prefix = operationalBusinessCodePrefix(context);
  const pattern = new RegExp(
    `^${escapeRegex(prefix)}(\\d{${context.recordType === "AUDIT" ? 2 : 3}})/${context.year}$`,
  );
  const match = pattern.exec(code.trim());
  if (!match) return null;
  const sequence = Number(match[1]);
  return Number.isInteger(sequence) && sequence >= 1 && sequence <= (context.recordType === "AUDIT" ? 99 : 999)
    ? sequence
    : null;
}

async function usedOperationalBusinessCodes(
  db: QmsRecordReader,
  context: OperationalBusinessCodeContext,
) {
  const prefix = operationalBusinessCodePrefix(context);
  return db.qmsRecord.findMany({
    where: {
      recordType: context.recordType,
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

export async function suggestOperationalBusinessCode(
  db: QmsRecordReader,
  context: OperationalBusinessCodeContext,
) {
  const records = await usedOperationalBusinessCodes(db, context);
  let maxSequence = 0;
  for (const record of records) {
    for (const candidate of [record.businessCode, record.annulledBusinessCode]) {
      const sequence = extractOperationalBusinessCodeSequence(candidate, context);
      if (sequence && sequence > maxSequence) maxSequence = sequence;
    }
  }
  const nextSequence = maxSequence + 1;
  if (nextSequence > (context.recordType === "AUDIT" ? 99 : 999)) {
    throw new OperationalBusinessCodeError(
      "EXHAUSTED",
      `Se ha agotado el correlativo para ${operationalBusinessCodePrefix(context)} en ${context.year}.`,
    );
  }
  return buildOperationalBusinessCode(context, nextSequence);
}

async function lockOperationalBusinessCodeSequence(
  tx: Tx,
  context: OperationalBusinessCodeContext,
) {
  const lockKey = `BUSINESS_CODE:${context.recordType}:${operationalBusinessCodePrefix(context)}:${context.year}`;
  await tx.$queryRaw(
    Prisma.sql`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${lockKey}))) AS q`,
  );
}

export async function assignOperationalBusinessCode(
  tx: Tx,
  input: OperationalBusinessCodeContext & {
    requestedCode?: string | null;
    excludeQmsRecordId?: string;
  },
) {
  await lockOperationalBusinessCodeSequence(tx, input);

  const requestedCode = input.requestedCode?.trim() || null;
  if (requestedCode) {
    if (extractOperationalBusinessCodeSequence(requestedCode, input) === null) {
      throw new OperationalBusinessCodeError(
        "INVALID_FORMAT",
        `La codificación debe seguir el formato ${operationalBusinessCodeFormat(input)}.`,
      );
    }

    const duplicate = await tx.qmsRecord.findFirst({
      where: {
        recordType: input.recordType,
        ...(input.excludeQmsRecordId ? { id: { not: input.excludeQmsRecordId } } : {}),
        OR: [
          { businessCode: requestedCode },
          { annulledBusinessCode: requestedCode },
        ],
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new OperationalBusinessCodeError(
        "ALREADY_USED",
        "Esa codificación ya ha sido utilizada por otro expediente, incluida la numeración histórica anulada.",
      );
    }
    return requestedCode;
  }

  return suggestOperationalBusinessCode(tx, input);
}
