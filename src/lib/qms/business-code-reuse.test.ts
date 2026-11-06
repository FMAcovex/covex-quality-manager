import { describe, expect, it } from "vitest";
import { Prisma, QmsRecordType } from "@prisma/client";
import {
  assignDeviationBusinessCode,
  assignOperationalBusinessCode,
  suggestDeviationBusinessCode,
  suggestOperationalBusinessCode,
} from "@/lib/qms/business-code";

// D-133: un código anulado vuelve a estar disponible. Cliente en memoria con lo justo de Prisma.
type Row = { id: string; recordType: QmsRecordType; businessCode: string | null; annulledBusinessCode: string | null };
type Condition = string | { startsWith?: string; not?: string } | undefined;

function matchesValue(value: string | null, condition: Condition) {
  if (condition === undefined) return true;
  if (typeof condition === "string") return value === condition;
  if (condition.startsWith !== undefined) return value !== null && value.startsWith(condition.startsWith);
  if (condition.not !== undefined) return value !== condition.not;
  return true;
}

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Record<string, unknown>[]).some((part) => matches(row, part));
    if (key === "recordType") return row.recordType === condition;
    if (key === "id" || key === "businessCode" || key === "annulledBusinessCode") return matchesValue(row[key], condition as Condition);
    throw new Error(`Condición no soportada en la prueba: ${key}`);
  });
}

function fakeTx(rows: Row[]) {
  return {
    $queryRaw: async () => [],
    qmsRecord: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => matches(row, where)),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((row) => matches(row, where)) ?? null,
    },
  } as unknown as Prisma.TransactionClient;
}

const deviation = (id: string, businessCode: string | null, annulledBusinessCode: string | null = null): Row => ({ id, recordType: QmsRecordType.DEVIATION, businessCode, annulledBusinessCode });
const capa = (id: string, businessCode: string | null, annulledBusinessCode: string | null = null): Row => ({ id, recordType: QmsRecordType.CAPA, businessCode, annulledBusinessCode });
const capaContext = { recordType: QmsRecordType.CAPA, year: 2026, departmentCode: "GC-00", actionType: "CORRECTIVE" as const };

describe("D-133 · reutilización de códigos anulados", () => {
  it("Desviaciones: admite escribir el código de una desviación anulada", async () => {
    const tx = fakeTx([deviation("a", "D/GC-00/001/2026"), deviation("b", null, "D/GC-00/002/2026")]);
    await expect(assignDeviationBusinessCode(tx, { departmentCode: "GC-00", year: 2026, requestedCode: "D/GC-00/002/2026" })).resolves.toBe("D/GC-00/002/2026");
  });

  it("Desviaciones: sigue rechazando el código de otra desviación activa", async () => {
    const tx = fakeTx([deviation("a", "D/GC-00/001/2026"), deviation("b", null, "D/GC-00/001/2026")]);
    await expect(assignDeviationBusinessCode(tx, { departmentCode: "GC-00", year: 2026, requestedCode: "D/GC-00/001/2026" })).rejects.toMatchObject({ reason: "ALREADY_USED" });
  });

  it("Desviaciones: el propio expediente puede conservar su código en borrador", async () => {
    const tx = fakeTx([deviation("a", "D/GC-00/001/2026")]);
    await expect(assignDeviationBusinessCode(tx, { departmentCode: "GC-00", year: 2026, requestedCode: "D/GC-00/001/2026", excludeQmsRecordId: "a" })).resolves.toBe("D/GC-00/001/2026");
  });

  it("Desviaciones: la sugerencia sigue al último código activo y ofrece el anulado si era el último", async () => {
    const tx = fakeTx([deviation("a", "D/GC-00/001/2026"), deviation("b", "D/GC-00/002/2026"), deviation("c", null, "D/GC-00/003/2026")]);
    await expect(suggestDeviationBusinessCode(tx, "GC-00", 2026)).resolves.toBe("D/GC-00/003/2026");
    const auto = await assignDeviationBusinessCode(tx, { departmentCode: "GC-00", year: 2026, requestedCode: null });
    expect(auto).toBe("D/GC-00/003/2026");
  });

  it("Desviaciones: un anulado intermedio no cambia la sugerencia (se puede escribir a mano)", async () => {
    const tx = fakeTx([deviation("a", "D/GC-00/001/2026"), deviation("b", null, "D/GC-00/002/2026"), deviation("c", "D/GC-00/003/2026")]);
    await expect(suggestDeviationBusinessCode(tx, "GC-00", 2026)).resolves.toBe("D/GC-00/004/2026");
  });

  it("Resto de módulos: admite el código anulado y rechaza el activo", async () => {
    const tx = fakeTx([capa("a", "AC/GC-00/001/2026"), capa("b", null, "AC/GC-00/002/2026")]);
    await expect(assignOperationalBusinessCode(tx, { ...capaContext, requestedCode: "AC/GC-00/002/2026" })).resolves.toBe("AC/GC-00/002/2026");
    await expect(assignOperationalBusinessCode(tx, { ...capaContext, requestedCode: "AC/GC-00/001/2026" })).rejects.toMatchObject({ reason: "ALREADY_USED" });
  });

  it("Resto de módulos: la sugerencia ofrece el anulado si era el último", async () => {
    const tx = fakeTx([capa("a", "AC/GC-00/001/2026"), capa("b", null, "AC/GC-00/002/2026")]);
    await expect(suggestOperationalBusinessCode(tx, capaContext)).resolves.toBe("AC/GC-00/002/2026");
  });

  it("OOS: las series API y MD son independientes y reutilizan su último anulado", async () => {
    const oos = (id: string, businessCode: string | null, annulled: string | null = null): Row => ({ id, recordType: QmsRecordType.OOS, businessCode, annulledBusinessCode: annulled });
    const tx = fakeTx([oos("a", "OOS/MD/001/2026"), oos("b", "OOS/MD/002/2026"), oos("c", null, "OOS/MD/003/2026"), oos("d", "OOS/API/007/2026")]);
    await expect(suggestOperationalBusinessCode(tx, { recordType: QmsRecordType.OOS, year: 2026, oosArea: "MD" })).resolves.toBe("OOS/MD/003/2026");
    await expect(suggestOperationalBusinessCode(tx, { recordType: QmsRecordType.OOS, year: 2026, oosArea: "API" })).resolves.toBe("OOS/API/008/2026");
  });

  it("Auditorías: la serie de dos cifras reutiliza su último anulado", async () => {
    const audit = (id: string, businessCode: string | null, annulled: string | null = null): Row => ({ id, recordType: QmsRecordType.AUDIT, businessCode, annulledBusinessCode: annulled });
    const context = { recordType: QmsRecordType.AUDIT, year: 2026, departmentCode: "GC-00", auditType: "INTERNAL" as const, auditScenario: "INTERNAL_COVEX" as const };
    const tx = fakeTx([audit("a", "AI/GC-00/01/2026"), audit("b", null, "AI/GC-00/02/2026")]);
    await expect(suggestOperationalBusinessCode(tx, context)).resolves.toBe("AI/GC-00/02/2026");
    await expect(assignOperationalBusinessCode(tx, { ...context, requestedCode: "AI/GC-00/02/2026" })).resolves.toBe("AI/GC-00/02/2026");
  });

  it("CAPA: un anulado de la serie AP no cambia la serie AC, y un borrador con código bloquea el suyo", async () => {
    const tx = fakeTx([capa("a", "AC/GC-00/001/2026"), capa("b", null, "AP/GC-00/004/2026"), capa("draft", "AC/GC-00/002/2026")]);
    await expect(suggestOperationalBusinessCode(tx, capaContext)).resolves.toBe("AC/GC-00/003/2026");
    await expect(suggestOperationalBusinessCode(tx, { ...capaContext, actionType: "PREVENTIVE" })).resolves.toBe("AP/GC-00/001/2026");
    await expect(assignOperationalBusinessCode(tx, { ...capaContext, requestedCode: "AC/GC-00/002/2026" })).rejects.toMatchObject({ reason: "ALREADY_USED" });
  });
});
