import { describe, expect, it, vi, beforeEach } from "vitest";
import { QmsRecordType } from "@prisma/client";

const { findUnique, findManyRelations, findManyRecords } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findManyRelations: vi.fn(),
  findManyRecords: vi.fn(),
}));

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

vi.mock("@/lib/auth/context", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/context")>()), currentIdentity: () => ({ principal: { id: "synthetic-editor" } }) }));
// La guarda de la ruta se prueba aparte; aquí solo interesa el filtrado por edición de los resultados.
vi.mock("@/lib/auth/route-guard", () => ({ authorizedRoute: (_file: string, _method: string, args: unknown[], run: (a: unknown[]) => unknown) => run(args) }));
vi.mock("@/lib/auth/presentation", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/auth/presentation")>()), canPresent: () => true }));

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

  it("desde una auditoría ofrece también borradores sin código, por su descripción, solo con filtro de edición (R5B1)", async () => {
    findUnique.mockResolvedValue({ id: "audit", recordType: QmsRecordType.AUDIT, isActive: true });
    findManyRecords.mockResolvedValue([
      { id: "draft", recordType: QmsRecordType.CAPA, businessCode: null, year: null, capa: { status: "DRAFT", defectDescription: "Revisar balanzas de proceso" } },
      { id: "open", recordType: QmsRecordType.CAPA, businessCode: "AC/GC-00/001/2026", year: 2026, capa: { status: "OPEN", defectDescription: "Otra" } },
    ]);
    const response = await GET(new Request("http://localhost/api/qms/relation-suggestions?editable=1&currentRecordId=audit&currentType=AUDIT&relatedType=CAPA&q=balanzas"));
    expect(response.status).toBe(200);
    const where = findManyRecords.mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toContain('"not":"DRAFT"');
    expect(JSON.stringify(where)).toContain("defectDescription");
    const body = await response.json();
    expect(body.suggestions.map((s: { id: string; displayLabel: string }) => [s.id, s.displayLabel])).toEqual([
      ["open", "AC/GC-00/001/2026"],
      ["draft", "Borrador · Revisar balanzas de proceso"],
    ]);
  });

  it("sin filtro de edición no busca ni expone el texto de los borradores", async () => {
    findUnique.mockResolvedValue({ id: "audit", recordType: QmsRecordType.AUDIT, isActive: true });
    await GET(new Request("http://localhost/api/qms/relation-suggestions?currentRecordId=audit&currentType=AUDIT&relatedType=CAPA&q=balanzas"));
    const query = findManyRecords.mock.calls[0][0];
    expect(JSON.stringify(query)).not.toContain("defectDescription");
  });
});
