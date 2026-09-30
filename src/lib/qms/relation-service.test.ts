import { describe, expect, it, vi } from "vitest";
import { QmsRecordType, QmsRelationType } from "@prisma/client";
import {
  createQmsRelation,
  deactivateOperationalRelation,
  deactivateQmsRelation,
  getIncomingRelations,
  getOutgoingRelations,
  linkOperationalRelationByBusinessCode,
  type QmsRelationHistoryClient,
} from "@/lib/qms/relation-service";

type StoredRecord = {
  id: string;
  recordType: QmsRecordType;
  businessCode: string;
};

type StoredRelation = {
  id: string;
  sourceRecordId: string;
  targetRecordId: string;
  relationType: QmsRelationType;
  createdByText: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
};

type UpsertArgs = {
  where: {
    sourceRecordId_targetRecordId_relationType: {
      sourceRecordId: string;
      targetRecordId: string;
      relationType: QmsRelationType;
    };
  };
  update: { isActive: boolean };
  create: Omit<StoredRelation, "id" | "createdAt" | "isActive">;
};

function createMemoryClient(records: StoredRecord[]) {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const relations: StoredRelation[] = [];

  const client = {
    qmsRecord: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          recordMap.get(where.id) ?? null,
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            businessCode?: string;
            recordType?: QmsRecordType;
            id?: { not?: string };
          };
        }) =>
          records.filter(
            (record) =>
              (!where.businessCode || record.businessCode === where.businessCode) &&
              (!where.recordType || record.recordType === where.recordType) &&
              (!where.id?.not || record.id !== where.id.not),
          ),
      ),
    },
    qmsRelation: {
      upsert: vi.fn(async ({ where, update, create }: UpsertArgs) => {
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
        const relation: StoredRelation = {
          ...create,
          id: `relation-${relations.length + 1}`,
          isActive: true,
          createdAt: new Date("2026-09-29T00:00:00Z"),
        };
        relations.push(relation);
        return relation;
      }),
      findUnique: vi.fn(async ({ where }: { where: { sourceRecordId_targetRecordId_relationType: { sourceRecordId: string; targetRecordId: string; relationType: QmsRelationType } } }) => {
        const key = where.sourceRecordId_targetRecordId_relationType;
        return relations.find(
          (relation) =>
            relation.sourceRecordId === key.sourceRecordId &&
            relation.targetRecordId === key.targetRecordId &&
            relation.relationType === key.relationType,
        ) ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { isActive: boolean } }) => {
        const relation = relations.find((item) => item.id === where.id);
        if (!relation) throw new Error("Relation not found");
        relation.isActive = data.isActive;
        return relation;
      }),
      findMany: vi.fn(
        async ({
          where,
          include,
        }: {
          where: {
            sourceRecordId?: string;
            targetRecordId?: string;
            isActive: boolean;
          };
          include: { sourceRecord?: boolean; targetRecord?: boolean };
        }) =>
          relations
            .filter(
              (relation) =>
                relation.isActive === where.isActive &&
                (!where.sourceRecordId ||
                  relation.sourceRecordId === where.sourceRecordId) &&
                (!where.targetRecordId ||
                  relation.targetRecordId === where.targetRecordId),
            )
            .map((relation) => ({
              ...relation,
              ...(include.sourceRecord
                ? { sourceRecord: recordMap.get(relation.sourceRecordId) }
                : {}),
              ...(include.targetRecord
                ? { targetRecord: recordMap.get(relation.targetRecordId) }
                : {}),
            })),
      ),
    },
    changeHistory: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
  } as unknown as QmsRelationHistoryClient;

  return { client, relations };
}

const records: StoredRecord[] = [
  { id: "deviation-qms", recordType: QmsRecordType.DEVIATION, businessCode: "D/1" },
  { id: "complaint-qms", recordType: QmsRecordType.COMPLAINT, businessCode: "R/1" },
  { id: "capa-qms", recordType: QmsRecordType.CAPA, businessCode: "AC/1" },
  { id: "return-qms", recordType: QmsRecordType.RETURN, businessCode: "DEV/1" },
];

describe("Hito 10.8C3-B1: servicio común de relaciones QMS", () => {
  it("almacena IDs de QmsRecord y no duplica la misma relación", async () => {
    const { client, relations } = createMemoryClient(records);
    const input = {
      sourceRecordId: "deviation-qms",
      targetRecordId: "capa-qms",
      createdByText: "QA",
    };

    const first = await createQmsRelation(client, input);
    const second = await createQmsRelation(client, input);

    expect(first.id).toBe(second.id);
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({
      sourceRecordId: "deviation-qms",
      targetRecordId: "capa-qms",
      relationType: QmsRelationType.GENERATES,
    });
  });

  it("permite consultar el origen de CAPA y Devolución sin fila inversa", async () => {
    const { client, relations } = createMemoryClient(records);
    await createQmsRelation(client, {
      sourceRecordId: "deviation-qms",
      targetRecordId: "capa-qms",
    });
    await createQmsRelation(client, {
      sourceRecordId: "complaint-qms",
      targetRecordId: "capa-qms",
    });
    await createQmsRelation(client, {
      sourceRecordId: "complaint-qms",
      targetRecordId: "return-qms",
    });

    const capaOrigins = await getIncomingRelations(client, "capa-qms");
    const returnOrigins = await getIncomingRelations(client, "return-qms");
    const complaintDerived = await getOutgoingRelations(client, "complaint-qms");

    expect(capaOrigins.map((item) => item.sourceRecord.recordType)).toEqual([
      QmsRecordType.DEVIATION,
      QmsRecordType.COMPLAINT,
    ]);
    expect(returnOrigins[0].sourceRecord.recordType).toBe(QmsRecordType.COMPLAINT);
    expect(complaintDerived.map((item) => item.targetRecord.recordType)).toEqual([
      QmsRecordType.CAPA,
      QmsRecordType.RETURN,
    ]);
    expect(relations).toHaveLength(3);
    expect(
      relations.some(
        (relation) =>
          relation.sourceRecordId === "capa-qms" ||
          relation.sourceRecordId === "return-qms",
      ),
    ).toBe(false);
  });

  it("rechaza IDs que no sean QmsRecord existentes", async () => {
    const { client } = createMemoryClient(records);
    await expect(
      createQmsRelation(client, {
        sourceRecordId: "deviation-specific-id",
        targetRecordId: "capa-qms",
      }),
    ).rejects.toThrow(/expediente QMS de origen no existe/);
  });

  it("rechaza relaciones inversas y consigo mismo con errores funcionales", async () => {
    const { client } = createMemoryClient(records);
    await expect(
      createQmsRelation(client, {
        sourceRecordId: "capa-qms",
        targetRecordId: "deviation-qms",
      }),
    ).rejects.toThrow(/Relación no permitida/);
    await expect(
      createQmsRelation(client, {
        sourceRecordId: "capa-qms",
        targetRecordId: "capa-qms",
      }),
    ).rejects.toThrow(/consigo mismo/);
  });
  it("vincula por código desde cualquiera de los extremos respetando la dirección canónica", async () => {
    const { client, relations } = createMemoryClient(records);

    await linkOperationalRelationByBusinessCode(client, {
      currentRecordId: "capa-qms",
      currentType: QmsRecordType.CAPA,
      relatedType: QmsRecordType.DEVIATION,
      businessCode: "D/1",
      createdByText: "QA",
    });
    await linkOperationalRelationByBusinessCode(client, {
      currentRecordId: "return-qms",
      currentType: QmsRecordType.RETURN,
      relatedType: QmsRecordType.COMPLAINT,
      businessCode: "R/1",
      createdByText: "QA",
    });

    expect(relations).toHaveLength(2);
    expect(relations[0]).toMatchObject({
      sourceRecordId: "deviation-qms",
      targetRecordId: "capa-qms",
    });
    expect(relations[1]).toMatchObject({
      sourceRecordId: "complaint-qms",
      targetRecordId: "return-qms",
    });
  });

  it("desvincula transversalmente desde el extremo actual y permite reactivar la misma fila", async () => {
    const { client, relations } = createMemoryClient(records);
    await createQmsRelation(client, {
      sourceRecordId: "complaint-qms",
      targetRecordId: "return-qms",
      createdByText: "QA",
    });

    await deactivateOperationalRelation(client, {
      currentRecordId: "return-qms",
      relatedRecordId: "complaint-qms",
      changedByText: "QA",
      reason: "Prueba D5.2",
    });

    expect(relations).toHaveLength(1);
    expect(relations[0].isActive).toBe(false);

    await linkOperationalRelationByBusinessCode(client, {
      currentRecordId: "return-qms",
      currentType: QmsRecordType.RETURN,
      relatedType: QmsRecordType.COMPLAINT,
      businessCode: "R/1",
      createdByText: "QA",
    });
    expect(relations).toHaveLength(1);
    expect(relations[0].isActive).toBe(true);
  });

  it("desactiva una relación sin eliminar los expedientes y desaparece en ambos sentidos", async () => {
    const { client, relations } = createMemoryClient(records);
    await createQmsRelation(client, {
      sourceRecordId: "deviation-qms",
      targetRecordId: "capa-qms",
      createdByText: "QA",
    });

    await deactivateQmsRelation(client, {
      sourceRecordId: "deviation-qms",
      targetRecordId: "capa-qms",
    });

    expect(relations).toHaveLength(1);
    expect(relations[0].isActive).toBe(false);
    expect(await getOutgoingRelations(client, "deviation-qms")).toHaveLength(0);
    expect(await getIncomingRelations(client, "capa-qms")).toHaveLength(0);

    await createQmsRelation(client, {
      sourceRecordId: "deviation-qms",
      targetRecordId: "capa-qms",
      createdByText: "QA",
    });
    expect(relations).toHaveLength(1);
    expect(relations[0].isActive).toBe(true);
  });

});
