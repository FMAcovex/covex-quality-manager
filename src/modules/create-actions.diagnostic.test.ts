import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, QmsRecordType } from "@prisma/client";

const diagnostic = vi.hoisted(() => ({ causes: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new Error(`NEXT_REDIRECT:${location}`);
  },
}));
vi.mock("@/lib/forms/persistence-error", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/forms/persistence-error")>();
  return {
    ...original,
    persistenceFormError: (error: unknown, ...args: Parameters<typeof original.persistenceFormError> extends [unknown, ...infer R] ? R : never) => {
      diagnostic.causes.push(error);
      console.error("A2.1 REAL PERSISTENCE ERROR", error);
      return original.persistenceFormError(error, ...args);
    },
  };
});

import { createDeviationAction } from "@/modules/deviations/actions";
import { createCapaAction } from "@/modules/capa/actions";

const prisma = new PrismaClient();
const suffix = `${Date.now()}`;
const deviationCode = `D/A21/001/${suffix}`;
const capaCode = `AC/A21/001/${suffix}`;
let departmentId = "";

function expectRedirect(result: Promise<unknown>, expectedPath: RegExp) {
  return expect(result).rejects.toThrow(expectedPath);
}

beforeAll(async () => {
  departmentId = (await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.sequential("A2.1 server actions reales", () => {
  it("crea una desviación OPEN desde el FormData de la interfaz", async () => {
    const formData = new FormData();
    formData.set("businessCode", deviationCode);
    formData.set("departmentId", departmentId);
    formData.set("issueDate", "2098-03-01");
    formData.set("eventDateTime", "2098-03-01T10:15");
    formData.set("createdByText", "Diagnóstico A2.1");
    formData.set("whatHappened", "Evento ficticio de reproducción por la interfaz.");
    formData.set("status", "OPEN");
    formData.set("dataQualityStatus", "REVIEW_REQUIRED");
    formData.set("immediateActionsJson", JSON.stringify([{ description: "Contención ficticia", executedBy: "QA", executedAt: "2098-03-01" }]));
    formData.set("capaPlansJson", JSON.stringify([{ actionType: "CORRECTIVE", description: "Propuesta ficticia", plannedExecutionDate: "2098-03-15", responsible: "QA" }]));

    console.log("A2.1 DEVIATION FORMDATA", Object.fromEntries(formData.entries()));
    await expectRedirect(createDeviationAction({ error: null }, formData), /NEXT_REDIRECT:\/deviations\//);

    const stored = await prisma.qmsRecord.findUnique({
      where: { recordType_businessCode: { recordType: QmsRecordType.DEVIATION, businessCode: deviationCode } },
      include: { deviation: { include: { immediateActions: true, capaPlans: true } }, versions: true, history: true },
    });
    console.log("A2.1 DEVIATION STORED", stored);
    expect(stored?.year).toBe(2098);
    expect(stored?.deviation?.status).toBe("OPEN");
    expect(stored?.deviation?.immediateActions).toHaveLength(1);
    expect(stored?.deviation?.capaPlans).toHaveLength(1);
    expect(stored?.versions.map((version) => version.sequenceNumber)).toEqual([0]);
    expect(stored?.history).toHaveLength(1);
  });

  it("crea una CAPA OPEN desde el FormData de la interfaz", async () => {
    const formData = new FormData();
    formData.set("businessCode", capaCode);
    formData.set("actionType", "CORRECTIVE");
    formData.set("departmentId", departmentId);
    formData.set("openedAt", "2098-03-02");
    formData.set("createdByText", "Diagnóstico A2.1");
    formData.set("originType", "Desviación");
    formData.set("originCode", deviationCode);
    formData.set("defectDescription", "Defecto ficticio de reproducción por la interfaz.");
    formData.set("rootCause", "Causa ficticia sustentada.");
    formData.set("status", "OPEN");
    formData.set("effectivenessStatus", "PENDING");
    formData.set("dataQualityStatus", "REVIEW_REQUIRED");
    formData.set("plannedActionsJson", JSON.stringify([{ description: "Acción planificada ficticia", responsible: "QA", plannedExecutionDate: "2098-03-20", impact: "" }]));

    console.log("A2.1 CAPA FORMDATA", Object.fromEntries(formData.entries()));
    await expectRedirect(createCapaAction({ error: null }, formData), /NEXT_REDIRECT:\/capa\//);

    const stored = await prisma.qmsRecord.findUnique({
      where: { recordType_businessCode: { recordType: QmsRecordType.CAPA, businessCode: capaCode } },
      include: { capa: { include: { plannedActions: true } }, versions: true, history: true, targetRelations: true },
    });
    console.log("A2.1 CAPA STORED", stored);
    expect(stored?.year).toBe(2098);
    expect(stored?.capa?.status).toBe("OPEN");
    expect(stored?.capa?.plannedActions).toHaveLength(1);
    expect(stored?.versions.map((version) => version.sequenceNumber)).toEqual([0]);
    expect(stored?.history).toHaveLength(1);
    expect(stored?.targetRelations).toHaveLength(1);
  });

  it("no ha ocultado ninguna excepción de persistencia", () => {
    expect(diagnostic.causes).toEqual([]);
  });
});
