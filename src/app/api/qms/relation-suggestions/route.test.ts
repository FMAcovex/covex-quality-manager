import { describe, expect, it, vi, beforeEach } from "vitest";
import { QmsRecordType } from "@prisma/client";

const findUnique = vi.fn();
const findManyRelations = vi.fn();
const findManyRecords = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    qmsRecord: {
      findUnique,
      findMany: findManyRecords,
    },
    qmsRelation: {
      findMany: findManyRelations,
    },
  },
}));

import { GET } from "@/app/api/qms/relation-suggestions/route";

describe("relation suggestions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue({
      id: "current",
      recordType: QmsRecordType.COMPLAINT,
      isActive: true,
    });
    findManyRelations.mockResolvedValue([]);
    findManyRecords.mockResolvedValue([]);
  });

  it("rechaza combinaciones no permitidas", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/qms/relation-suggestions?currentRecordId=current&currentType=DEVIATION&relatedType=RETURN&q=DEV",
      ),
    );
    expect(response.status).toBe(400);
  });

  it("solo busca el tipo compatible activo y excluye relaciones ya activas", async () => {
    findManyRelations.mockResolvedValue([{ targetRecordId: "linked" }]);
    findManyRecords.mockResolvedValue([
      {
        id: "available",
        recordType: QmsRecordType.RETURN,
        businessCode: "DEMO-DEVOL-002-2026",
        year: 2026,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/qms/relation-suggestions?currentRecordId=current&currentType=COMPLAINT&relatedType=RETURN&q=DEMO",
      ),
    );
    expect(response.status).toBe(200);
    expect(findManyRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recordType: QmsRecordType.RETURN,
          isActive: true,
          id: { notIn: ["current", "linked"] },
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      suggestions: [
        {
          id: "available",
          recordType: QmsRecordType.RETURN,
          businessCode: "DEMO-DEVOL-002-2026",
          year: 2026,
        },
      ],
    });
  });

  it("admite búsqueda inversa CAPA → Desviación sin crear una relación inversa", async () => {
    findUnique.mockResolvedValue({
      id: "capa",
      recordType: QmsRecordType.CAPA,
      isActive: true,
    });
    findManyRelations.mockResolvedValue([]);
    findManyRecords.mockResolvedValue([
      {
        id: "dev",
        recordType: QmsRecordType.DEVIATION,
        businessCode: "D/GC-00/001/2026",
        year: 2026,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/qms/relation-suggestions?currentRecordId=capa&currentType=CAPA&relatedType=DEVIATION&q=D%2FGC",
      ),
    );
    expect(response.status).toBe(200);
    expect(findManyRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetRecordId: "capa",
        }),
      }),
    );
  });
});
