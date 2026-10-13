import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";

// Trusted server composition. A request cannot supply or select this client.
const key = Symbol.for("covex.database.transaction.context");
const shared = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<Prisma.TransactionClient> };
const transactions = shared[key] ??= new AsyncLocalStorage<Prisma.TransactionClient>();

export function contextualDatabase(db: PrismaClient): PrismaClient {
  return new Proxy(db, {
    get(target, property) {
      const tx = transactions.getStore();
      const receiver = tx && property in tx ? tx : target;
      const value = Reflect.get(receiver, property, receiver);
      return typeof value === "function" ? value.bind(receiver) : value;
    },
  });
}

/** Keep an existing domain transaction instead of committing a nested writer. */
export async function withDatabaseTransaction<T>(db: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const current = transactions.getStore();
  if (current) return run(current);
  return db.$transaction(tx => transactions.run(tx, () => run(tx)));
}
