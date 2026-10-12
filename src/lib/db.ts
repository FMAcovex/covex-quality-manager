import { PrismaClient } from "@prisma/client";
import { currentIdentity } from "./auth/context";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const identity = currentIdentity();
          const authored = new Set(["ChangeHistory", "QmsRecordVersion", "ReviewThread", "ReviewMessage", "GeneratedDocument", "ConfigurationChange", "AuditPlanChange", "ControlledDocumentChange", "ControlledRevisionDocument", "ControlledRevisionDecision", "ControlledDocumentImportEvent", "AuditAnnualProgrammeVersion"]);
          if (identity && !identity.unitTest && authored.has(model) && ["create", "createMany", "createManyAndReturn", "upsert"].includes(operation)) {
            const data = (args as { data?: unknown }).data;
            const names: Record<string, string> = { ChangeHistory: "changedByText", QmsRecordVersion: "createdByText", ReviewThread: "createdByText", ReviewMessage: "createdByText", GeneratedDocument: "generatedByText", ConfigurationChange: "changedByText", AuditPlanChange: "actor", ControlledDocumentChange: "changedByText", ControlledRevisionDocument: "incorporatedBy", ControlledRevisionDecision: "actor", ControlledDocumentImportEvent: "actor", AuditAnnualProgrammeVersion: "generatedBy" };
            const stamp = (row: unknown) => {
              const value = { ...(row as Record<string, unknown>), authenticatedUserId: identity.principal.id, [names[model]]: identity.principal.name };
              if (model === "ReviewThread" && value.messages) {
                const messages = value.messages as { create?: unknown };
                if (messages.create) value.messages = { ...messages, create: { ...(messages.create as object), authenticatedUserId: identity.principal.id, createdByText: identity.principal.name } };
              }
              return value;
            };
            if (operation === "upsert") (args as { create: unknown }).create = stamp((args as { create: unknown }).create);
            else (args as { data?: unknown }).data = Array.isArray(data) ? data.map(stamp) : stamp(data);
          }
          const result = await query(args);
          if (model === "QmsRecord" && operation === "create" && identity?.createdRecords) identity.createdRecords.add((result as { id: string }).id);
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
