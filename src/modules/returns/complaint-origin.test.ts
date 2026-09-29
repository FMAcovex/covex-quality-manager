import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  ComplaintReturnLinkError,
  getComplaintReturnOrigin,
  registerComplaintReturnOrigin,
  type ComplaintReturnClient,
} from "@/modules/returns/complaint-origin";

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

function createMemoryClient() {
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
      "return-1",
      {
        id: "return-1",
        recordType: QmsRecordType.RETURN,
        businessCode: "DEV/GC-00/001/2026",
      },
    ],
    [
      "return-2",
      {
        id: "return-2",
        recordType: QmsRecordType.RETURN,
        businessCode: "DEV/GC-00/002/2026",
      },
    ],
  ]);
  const relations: MemoryRelation[] = [];

  const client = {
    complaint: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== "complaint-1") return null;
        return {
          qmsRecordId: "complaint-qms",
          qmsRecord: { businessCode: "R/GC-00/001/2026" },
        };
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
  } as unknown as ComplaintReturnClient;

  return { client, relations };
}

describe("Hito 10.8C3-B4.1: Reclamación -> Devolución canónica", () => {
  it("resuelve la reclamación real y su código de negocio", async () => {
    const { client } = createMemoryClient();
    await expect(getComplaintReturnOrigin(client, "complaint-1")).resolves.toEqual({
      complaintQmsRecordId: "complaint-qms",
      complaintBusinessCode: "R/GC-00/001/2026",
    });
  });

  it("falla si la reclamación explícita ya no existe", async () => {
    const { client } = createMemoryClient();
    await expect(getComplaintReturnOrigin(client, "missing")).rejects.toThrow(
      ComplaintReturnLinkError,
    );
  });

  it("permite dos devoluciones distintas desde una misma reclamación", async () => {
    const { client, relations } = createMemoryClient();
    const origin = await getComplaintReturnOrigin(client, "complaint-1");

    await registerComplaintReturnOrigin(client, {
      complaintQmsRecordId: origin.complaintQmsRecordId,
      returnQmsRecordId: "return-1",
      actor: "QA",
    });
    await registerComplaintReturnOrigin(client, {
      complaintQmsRecordId: origin.complaintQmsRecordId,
      returnQmsRecordId: "return-2",
      actor: "QA",
    });

    expect(relations).toHaveLength(2);
    expect(relations.map((relation) => relation.targetRecordId).sort()).toEqual([
      "return-1",
      "return-2",
    ]);
  });

  it("reintentar la misma relación no crea duplicados", async () => {
    const { client, relations } = createMemoryClient();

    await registerComplaintReturnOrigin(client, {
      complaintQmsRecordId: "complaint-qms",
      returnQmsRecordId: "return-1",
      actor: "QA",
    });
    await registerComplaintReturnOrigin(client, {
      complaintQmsRecordId: "complaint-qms",
      returnQmsRecordId: "return-1",
      actor: "QA",
    });

    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      sourceRecordId: "complaint-qms",
      targetRecordId: "return-1",
      relationType: QmsRelationType.GENERATES,
    });
  });
});
