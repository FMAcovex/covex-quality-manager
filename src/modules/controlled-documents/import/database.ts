import { PrismaClient } from "@prisma/client";
import { contextualDatabase } from "@/lib/transaction-context";
import { currentIdentity } from "@/lib/auth/context";
// Import failures must not log workbook values or SQL diagnostics (including real codes).
const globalImport = globalThis as unknown as { controlledImportDb?: PrismaClient };
const configured = globalImport.controlledImportDb ?? new PrismaClient({log: [], errorFormat: "minimal"}).$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
  const identity = currentIdentity();
  const names: Record<string,string> = { ControlledDocumentChange: "changedByText", ControlledDocumentImportEvent: "actor" };
  if (identity && !identity.unitTest && names[model] && ["create","createMany","createManyAndReturn"].includes(operation)) {
    const stamp = (row: unknown) => ({ ...(row as object), authenticatedUserId: identity.principal.id, [names[model]]: identity.principal.name });
    const data = (args as {data: unknown}).data; (args as {data: unknown}).data = Array.isArray(data) ? data.map(stamp) : stamp(data);
  }
  return query(args);
} } } }) as unknown as PrismaClient;
globalImport.controlledImportDb = configured;
export const importDb = contextualDatabase(configured);
