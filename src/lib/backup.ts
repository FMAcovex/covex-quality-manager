import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

export const LOGICAL_BACKUP_FORMAT_VERSION = 1;

type FindManyDelegate = {
  findMany: (args?: Record<string, never>) => Promise<unknown[]>;
};

export function normalizeBackupValue(value: unknown): unknown {
  if (value instanceof Date) {
    return { $type: "Date", value: value.toISOString() };
  }
  if (value instanceof Uint8Array) {
    return {
      $type: "Bytes",
      encoding: "base64",
      value: Buffer.from(value).toString("base64"),
    };
  }
  if (typeof value === "bigint") {
    return { $type: "BigInt", value: value.toString() };
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeBackupValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeBackupValue(item)]),
    );
  }
  return value;
}

function delegateName(modelName: string) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

export async function createLogicalBackup(client: PrismaClient) {
  const models: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  const modelNames = Prisma.dmmf.datamodel.models
    .map((model) => model.name)
    .sort((a, b) => a.localeCompare(b));

  const delegates = client as unknown as Record<string, FindManyDelegate>;

  for (const modelName of modelNames) {
    const delegate = delegates[delegateName(modelName)];
    if (!delegate?.findMany) {
      throw new Error(`No existe un delegado Prisma para ${modelName}.`);
    }
    const rows = await delegate.findMany({});
    models[modelName] = normalizeBackupValue(rows) as unknown[];
    counts[modelName] = rows.length;
  }

  return {
    formatVersion: LOGICAL_BACKUP_FORMAT_VERSION,
    application: "covex-quality-manager",
    exportedAt: new Date().toISOString(),
    modelCount: modelNames.length,
    counts,
    models,
  };
}

export function backupChecksum(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}
