import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  DeviationCapaPlanLinkError,
  getDeviationCapaPlanOrigin,
  registerDeviationCapaPlan,
  type DeviationCapaPlanClient,
} from "@/modules/capa/deviation-origin";

type MemoryPlan = {
  id: string;
  linkedCapaRecordId: string | null;
  businessCapaCode: string | null;
  proposalStatus: "PROPOSED" | "REGISTERED" | "CANCELLED";
  deviation: {
    qmsRecordId: string;
    qmsRecord: { businessCode: string };
  };
};

type MemoryRelationUpsertArgs = {
  where: {
    sourceRecordId_targetRecordId_relationType: {
      sourceRecordId: string;
      targetRecordId: string;
      relationType: QmsRelationType;
    };
  };
  update: {
    isActive: boolean;
  };
  create: {
    sourceRecordId: string;
    targetRecordId: string;
    relationType: QmsRelationType;
  };
};

function createMemoryClient(plans: MemoryPlan[]) {
  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  const records = new Map([
    [
      "deviation-qms",
      {
        id: "deviation-qms",
        recordType: QmsRecordType.DEVIATION,
        businessCode: "D/GC-00/001/2026",
      },
    ],
    [
      "capa-1",
      {
        id: "capa-1",
        recordType: QmsRecordType.CAPA,
        businessCode: "AC/GC-00/001/2026",
      },
    ],
    [
      "capa-2",
      {
        id: "capa-2",
        recordType: QmsRecordType.CAPA,
        businessCode: "AP/GC-00/002/2026",
      },
    ],
  ]);
  const relations: Array<{
    id: string;
    sourceRecordId: string;
    targetRecordId: string;
    relationType: QmsRelationType;
    isActive: boolean;
  }> = [];

  const client = {
    deviationCapaPlan: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return planMap.get(where.id) ?? null;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: {
            id: string;
            proposalStatus: "PROPOSED";
            linkedCapaRecordId: null;
          };
          data: {
            linkedCapaRecordId: string;
            businessCapaCode: string;
            proposalStatus: "REGISTERED";
          };
        }) => {
          const plan = planMap.get(where.id);
          if (
            !plan ||
            plan.proposalStatus !== where.proposalStatus ||
            plan.linkedCapaRecordId !== where.linkedCapaRecordId
          ) {
            return { count: 0 };
          }
          plan.linkedCapaRecordId = data.linkedCapaRecordId;
          plan.businessCapaCode = data.businessCapaCode;
          plan.proposalStatus = data.proposalStatus;
          return { count: 1 };
        },
      ),
    },
    qmsRecord: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return records.get(where.id) ?? null;
      }),
    },
    qmsRelation: {
      upsert: vi.fn(async ({ where, update, create }: MemoryRelationUpsertArgs) => {
        const key = where.sourceRecordId_targetRecordId_relationType;
        const existing = relations.find(
          (relation) =>
            relation.sourceRecordId === key.sourceRecordId &&
            relation.targetRecordId === key.targetRecordId &&
            relation.relationType === key.relationType,
        );
        if (existing) {
          existing.isActive = update.isActive;
          return existing;
        }
        const relation = {
          id: `relation-${relations.length + 1}`,
          sourceRecordId: create.sourceRecordId,
          targetRecordId: create.targetRecordId,
          relationType: create.relationType,
          isActive: true,
        };
        relations.push(relation);
        return relation;
      }),
    },
  } as unknown as DeviationCapaPlanClient;

  return { client, planMap, relations };
}

const plan = (id: string): MemoryPlan => ({
  id,
  linkedCapaRecordId: null,
  businessCapaCode: null,
  proposalStatus: "PROPOSED",
  deviation: {
    qmsRecordId: "deviation-qms",
    qmsRecord: { businessCode: "D/GC-00/001/2026" },
  },
});

describe("Hito 10.8C3-B2.1: propuesta Desviación -> CAPA", () => {
  it("permite que dos propuestas de una misma desviación generen dos CAPA distintas", async () => {
    const { client, planMap, relations } = createMemoryClient([plan("plan-1"), plan("plan-2")]);

    const origin1 = await getDeviationCapaPlanOrigin(client, "plan-1");
    const origin2 = await getDeviationCapaPlanOrigin(client, "plan-2");

    await registerDeviationCapaPlan(client, {
      planId: origin1.planId,
      capaQmsRecordId: "capa-1",
      capaBusinessCode: "AC/GC-00/001/2026",
      actor: "QA",
    });
    await registerDeviationCapaPlan(client, {
      planId: origin2.planId,
      capaQmsRecordId: "capa-2",
      capaBusinessCode: "AP/GC-00/002/2026",
      actor: "QA",
    });

    expect(planMap.get("plan-1")).toMatchObject({
      proposalStatus: "REGISTERED",
      linkedCapaRecordId: "capa-1",
      businessCapaCode: "AC/GC-00/001/2026",
    });
    expect(planMap.get("plan-2")).toMatchObject({
      proposalStatus: "REGISTERED",
      linkedCapaRecordId: "capa-2",
      businessCapaCode: "AP/GC-00/002/2026",
    });
    expect(relations).toHaveLength(2);
    expect(relations.map((item) => [item.sourceRecordId, item.targetRecordId])).toEqual([
      ["deviation-qms", "capa-1"],
      ["deviation-qms", "capa-2"],
    ]);
  });

  it("impide que una propuesta registrada genere una segunda CAPA", async () => {
    const registered = plan("plan-1");
    registered.proposalStatus = "REGISTERED";
    registered.linkedCapaRecordId = "capa-1";
    const { client } = createMemoryClient([registered]);

    await expect(getDeviationCapaPlanOrigin(client, "plan-1")).rejects.toThrow(
      DeviationCapaPlanLinkError,
    );
    await expect(getDeviationCapaPlanOrigin(client, "plan-1")).rejects.toThrow(
      /no puede generar otra distinta/,
    );
  });

  it("si la propuesta cambia durante el guardado, no crea la relación", async () => {
    const { client } = createMemoryClient([plan("plan-1")]);
    vi.spyOn(client.deviationCapaPlan, "updateMany").mockResolvedValue({ count: 0 });

    await expect(
      registerDeviationCapaPlan(client, {
        planId: "plan-1",
        capaQmsRecordId: "capa-1",
        capaBusinessCode: "AC/GC-00/001/2026",
        actor: "QA",
      }),
    ).rejects.toThrow(/ha cambiado mientras se registraba/);
    expect(client.qmsRelation.upsert).not.toHaveBeenCalled();
  });
});
