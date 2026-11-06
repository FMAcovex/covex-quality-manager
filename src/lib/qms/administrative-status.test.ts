import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// D-133: reactivar a la vez que otro expediente toma el código liberado. El índice único rechaza
// la segunda escritura (P2002); la reactivación debe responder 409, no un error interno.
const state = vi.hoisted(() => ({ tx: null as unknown }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(state.tx) } }));

import { AdministrativeStatusError, changeAdministrativeStatus } from "@/lib/qms/administrative-status";

function tx(options: { reusedBy?: string; updateError?: unknown }) {
  return {
    $queryRaw: async () => [],
    qmsRecord: {
      findUnique: async () => ({ id: "a", recordType: "CAPA", isActive: false, businessCode: null, annulledBusinessCode: "AC/GC-00/005/2026", audit: null }),
      findFirst: async () => (options.reusedBy ? { id: options.reusedBy } : null),
      update: async () => { if (options.updateError) throw options.updateError; return {}; },
    },
    changeHistory: { create: async () => ({}) },
  };
}

describe("D-133 · reactivación de un expediente anulado", () => {
  it("no reactiva si otro expediente activo ya usa el código", async () => {
    state.tx = tx({ reusedBy: "b" });
    await expect(changeAdministrativeStatus("a", "REACTIVATE", "Motivo de prueba", "QA")).rejects.toMatchObject({ status: 409 });
  });

  it("responde 409 si otro expediente toma el código a la vez (P2002)", async () => {
    state.tx = tx({ updateError: new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" }) });
    const result = changeAdministrativeStatus("a", "REACTIVATE", "Motivo de prueba", "QA");
    await expect(result).rejects.toBeInstanceOf(AdministrativeStatusError);
    await expect(result).rejects.toMatchObject({ status: 409 });
  });

  it("reactiva y recupera el código si nadie lo usa", async () => {
    state.tx = tx({});
    await expect(changeAdministrativeStatus("a", "REACTIVATE", "Motivo de prueba", "QA")).resolves.toBe("ACTIVE");
  });
});
