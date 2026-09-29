import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  ComplaintCapaLinkError,
  getComplaintCapaPlanOrigin,
  getComplaintDirectOrigin,
  registerComplaintCapaPlan,
  registerComplaintDirectOrigin,
  type ComplaintCapaClient,
} from "@/modules/capa/complaint-origin";

type MemoryPlan = {
  id: string;
  linkedCapaRecordId: string | null;
  businessCapaCode: string | null;
  proposalStatus: "PROPOSED" | "REGISTERED" | "CANCELLED";
  complaint: {
    qmsRecordId: string;
    qmsRecord: { businessCode: string };
  };
};

type MemoryRelation = {
  id: string;
  sourceRecordId: string;
  targetRecordId: string;
  relationType: QmsRelationType;
  isActive: boolean;
};

type MemoryRelationUpsertArgs = {
  where: {
    sourceRecordId_targetRecordId_relationType: {
      sourceRecordId: string;
      targetRecordId: string;
      relationType: QmsRelationType;
    };
  };
  update: { isActive: boolean };
  create: {
    sourceRecordId: string;
    targetRecordId: string;
    relationType: QmsRelationType;
  };
};

function createMemoryClient(plans: MemoryPlan[]) {
  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  const complaint = {
    qmsRecordId: "complaint-qms",
    qmsRecord: { businessCode: "R/GC-00/001/2026" },
  };
  const records = new Map([
    [
      "complaint-qms",
      {
        id: "complaint-qms",
        recordType: QmsRecordType.COMPLAINT,
        businessCode: "R/GC-00/001/2026",
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
  const relations: MemoryRelation[] = [];

  const client = {
    complaintCapaPlan: {
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
    complaint: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return where.id === "complaint-1" ? complaint : null;
      }),
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
  } as unknown as ComplaintCapaClient;

  return { client, planMap, relations };
}

const plan = (id: string): MemoryPlan => ({
  id,
  linkedCapaRecordId: null,
  businessCapaCode: null,
  proposalStatus: "PROPOSED",
  complaint: {
    qmsRecordId: "complaint-qms",
    qmsRecord: { businessCode: "R/GC-00/001/2026" },
  },
});

describe("Hito 10.8C3-B3.1: Reclamación -> CAPA canónica", () => {
  it("permite que dos propuestas de una misma reclamación generen dos CAPA distintas", async () => {
    const { client, planMap, relations } = createMemoryClient([plan("plan-1"), plan("plan-2")]);

    const origin1 = await getComplaintCapaPlanOrigin(client, "plan-1");
    const origin2 = await getComplaintCapaPlanOrigin(client, "plan-2");

    await registerComplaintCapaPlan(client, {
      planId: origin1.planId,
      capaQmsRecordId: "capa-1",
      capaBusinessCode: "AC/GC-00/001/2026",
      actor: "QA",
    });
    await registerComplaintCapaPlan(client, {
      planId: origin2.planId,
      capaQmsRecordId: "capa-2",
      capaBusinessCode: "AP/GC-00/002/2026",
      actor: "QA",
    });

    expect(planMap.get("plan-1")).toMatchObject({
      proposalStatus: "REGISTERED",
      linkedCapaRecordId: "capa-1",
    });
    expect(planMap.get("plan-2")).toMatchObject({
      proposalStatus: "REGISTERED",
      linkedCapaRecordId: "capa-2",
    });
    expect(relations).toHaveLength(2);
  });

  it("impide reutilizar una propuesta registrada o cancelada", async () => {
    const registered = plan("registered");
    registered.proposalStatus = "REGISTERED";
    registered.linkedCapaRecordId = "capa-1";
    const cancelled = plan("cancelled");
    cancelled.proposalStatus = "CANCELLED";
    const { client } = createMemoryClient([registered, cancelled]);

    await expect(getComplaintCapaPlanOrigin(client, "registered")).rejects.toThrow(
      ComplaintCapaLinkError,
    );
    await expect(getComplaintCapaPlanOrigin(client, "cancelled")).rejects.toThrow(
      /cancelada/,
    );
  });

  it("bloquea el registro si la propuesta cambia durante la transacción", async () => {
    const { client } = createMemoryClient([plan("plan-1")]);
    vi.spyOn(client.complaintCapaPlan, "updateMany").mockResolvedValue({ count: 0 });

    await expect(
      registerComplaintCapaPlan(client, {
        planId: "plan-1",
        capaQmsRecordId: "capa-1",
        capaBusinessCode: "AC/GC-00/001/2026",
        actor: "QA",
      }),
    ).rejects.toThrow(/ha cambiado mientras se registraba/);
    expect(client.qmsRelation.upsert).not.toHaveBeenCalled();
  });

  it("crea una sola relación en el flujo directo desde reclamación", async () => {
    const { client, relations } = createMemoryClient([]);
    const direct = await getComplaintDirectOrigin(client, "complaint-1");

    await registerComplaintDirectOrigin(client, {
      complaintQmsRecordId: direct.complaintQmsRecordId,
      capaQmsRecordId: "capa-1",
      actor: "QA",
    });

    expect(direct.complaintBusinessCode).toBe("R/GC-00/001/2026");
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      sourceRecordId: "complaint-qms",
      targetRecordId: "capa-1",
      relationType: QmsRelationType.GENERATES,
    });
  });
});
