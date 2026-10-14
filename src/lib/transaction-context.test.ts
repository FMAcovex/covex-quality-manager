import { describe, expect, it } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import { contextualDatabase, withDatabaseTransaction, inBusinessTransaction } from "./transaction-context";

describe("server transaction composition", () => {
  it("explicitly composes native callbacks and refuses weaker outer isolation or arrays", async () => {
    let opened = 0;
    const tx = { department: { count: async () => 7 } } as unknown as Prisma.TransactionClient;
    const db = contextualDatabase({ $transaction: async () => { opened++; } } as unknown as PrismaClient);
    await inBusinessTransaction(tx, undefined, async () => {
      expect(await db.$transaction(inner => inner.department.count())).toBe(7);
      await expect(db.$transaction(inner => inner.department.count(), { isolationLevel: "Serializable" })).rejects.toThrow("isolation");
      await expect(db.$transaction([])).rejects.toThrow("Array");
    });
    await inBusinessTransaction(tx, "Serializable", async () => {
      expect(await db.$transaction(inner => inner.department.count(), { isolationLevel: "RepeatableRead" })).toBe(7);
    });
    expect(opened).toBe(0);
    await db.$transaction(inner => inner.department.count());
    expect(opened).toBe(1);
  });
  it("routes business writes and history together and preserves the outer failure", async () => {
    const committed: string[] = [];
    const db = {
      department: { create: async () => committed.push("outside") },
      $transaction: async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
        const pending: string[] = [];
        const tx = { department: { create: async () => pending.push("department") }, configurationChange: { create: async () => { throw new Error("history unavailable"); } } };
        const result = await run(tx as unknown as Prisma.TransactionClient);
        committed.push(...pending); return result;
      },
    } as unknown as PrismaClient;
    const proxy = contextualDatabase(db);
    await expect(withDatabaseTransaction(proxy, async () => {
      await proxy.department.create({ data: { code: "SYNTH", name: "Synthetic" } });
      await proxy.configurationChange.create({ data: { entityType: "Department", entityKey: "SYNTH", action: "CREATE", changedByText: "Synthetic" } });
    })).rejects.toThrow("history unavailable");
    expect(committed).toEqual([]);
    await proxy.department.create({ data: { code: "SYNTH", name: "Synthetic" } });
    expect(committed).toEqual(["outside"]);
  });
  it("keeps simultaneous transaction contexts isolated and does not open a nested transaction", async () => {
    let opened = 0;
    const db = { $transaction: async (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      const id = ++opened;
      return run({ department: { count: async () => id } } as unknown as Prisma.TransactionClient);
    } } as unknown as PrismaClient;
    const proxy = contextualDatabase(db);
    const result = await Promise.all([0, 1].map(() => withDatabaseTransaction(proxy, async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      const first = await proxy.department.count();
      const second = await withDatabaseTransaction(proxy, tx => tx.department.count());
      return [first, second];
    })));
    expect(opened).toBe(2); expect(result).toEqual([[1, 1], [2, 2]]);
  });
});
