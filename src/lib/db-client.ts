import { Prisma, PrismaClient } from "@prisma/client";
import { currentIdentity } from "./auth/context";
import { binaryOmit } from "./db-binary-omit";
import { withJitDisabled } from "./db-url";

type AppClientOptions = {
  log?: (Prisma.LogLevel | Prisma.LogDefinition)[];
  /** Para pruebas y mediciones: recibe cada SQL emitido (requiere `log` con `emit: "event"` y nivel `query`). */
  onQuery?: (event: Prisma.QueryEvent) => void;
  /** Solo para la medición antes/después de BE1-A: `false` vuelve a leer los bytes como antes. */
  omitBinaries?: boolean;
};

/**
 * Cliente Prisma de la aplicación, sin efectos al importarse: sella autoría en las tablas registradas y, por
 * BE1-A (D-112), no lee los bytes de fichero salvo que la consulta los pida.
 */
export function createAppPrismaClient({ log = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"], onQuery, omitBinaries = true }: AppClientOptions = {}): PrismaClient {
  const base = new PrismaClient({ log, ...(omitBinaries ? { omit: binaryOmit } : {}), ...(process.env.DATABASE_URL ? { datasourceUrl: withJitDisabled(process.env.DATABASE_URL) } : {}) });
  if (onQuery) (base as unknown as { $on(event: "query", callback: (event: Prisma.QueryEvent) => void): void }).$on("query", onQuery);
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const identity = currentIdentity();
          const authored = new Set(["ChangeHistory", "QmsRecordVersion", "ReviewThread", "ReviewMessage", "GeneratedDocument", "ConfigurationChange", "AuditPlanChange", "ControlledDocumentChange", "ControlledRevisionDocument", "ControlledRevisionDecision", "ControlledDocumentImportEvent", "AuditAnnualProgrammeVersion", "AuditCapaPlanVersion"]);
          if (identity && !identity.unitTest && authored.has(model) && ["create", "createMany", "createManyAndReturn", "upsert"].includes(operation)) {
            const data = (args as { data?: unknown }).data;
            const names: Record<string, string> = { ChangeHistory: "changedByText", QmsRecordVersion: "createdByText", ReviewThread: "createdByText", ReviewMessage: "createdByText", GeneratedDocument: "generatedByText", ConfigurationChange: "changedByText", AuditPlanChange: "actor", ControlledDocumentChange: "changedByText", ControlledRevisionDocument: "incorporatedBy", ControlledRevisionDecision: "actor", ControlledDocumentImportEvent: "actor", AuditAnnualProgrammeVersion: "generatedBy", AuditCapaPlanVersion: "generatedBy" };
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
}
