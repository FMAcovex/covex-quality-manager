import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";

// Trusted server composition. A request cannot supply or select this client.
const key = Symbol.for("covex.database.transaction.context");
const shared = globalThis as typeof globalThis & { [key]?: AsyncLocalStorage<Prisma.TransactionClient> };
const transactions = shared[key] ??= new AsyncLocalStorage<Prisma.TransactionClient>();
const compositions = new AsyncLocalStorage<{ isolationLevel?: Prisma.TransactionIsolationLevel }>();

/** Lets adapters distinguish the contextual proxy from an ordinary standalone
 * client. The proxy deliberately still exposes `$transaction`, so property
 * detection alone cannot identify an active composed transaction. */
export function hasDatabaseTransaction() {
  return Boolean(transactions.getStore());
}

export function contextualDatabase(db: PrismaClient): PrismaClient {
  return new Proxy(db, {
    get(target, property) {
      const tx = transactions.getStore();
      if (tx && property === "$transaction" && compositions.getStore()) {
        return async (run: unknown, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }) => {
          if (typeof run !== "function") throw new Error("Array transactions cannot be nested in a business command");
          const isolation = compositions.getStore()!.isolationLevel;
          if (options?.isolationLevel && options.isolationLevel !== isolation && isolation !== "Serializable") {
            throw new Error("Nested transaction isolation requires an appropriate outer transaction");
          }
          return run(tx);
        };
      }
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

/** Bind an already opened, trusted server transaction to composed writers. */
export function inDatabaseTransaction<T>(tx: Prisma.TransactionClient, run: () => Promise<T>): Promise<T> {
  const current = transactions.getStore();
  if (current && current !== tx) throw new Error("Independent nested database transaction refused");
  return transactions.run(tx, run);
}

/** Explicit business-command composition; ordinary transactions keep their API. */
export function inBusinessTransaction<T>(tx: Prisma.TransactionClient, isolationLevel: Prisma.TransactionIsolationLevel | undefined, run: () => Promise<T>): Promise<T> {
  return compositions.run({ isolationLevel }, () => inDatabaseTransaction(tx, run));
}
