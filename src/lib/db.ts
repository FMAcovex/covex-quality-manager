import { PrismaClient } from "@prisma/client";
import { createAppPrismaClient } from "./db-client";
import { contextualDatabase } from "./transaction-context";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const configuredPrisma = globalForPrisma.prisma ?? createAppPrismaClient();

export const prisma = contextualDatabase(configuredPrisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = configuredPrisma;
}
