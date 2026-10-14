import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../db";
import { currentIdentity } from "../auth/context";
import { qmsScope } from "../auth/resources";
import { documentCommand } from "../audit/document-command";
import { auditPolicyState } from "../audit/activation";

export async function storeWorkingDocument(args: Prisma.GeneratedDocumentCreateArgs, output?: Uint8Array) {
  const qmsRecordId = args.data.qmsRecordId;
  if (!qmsRecordId) throw Error("Document requires its actual QMS root");
  const data = { ...args.data, ...(output ? { checksum: createHash("sha256").update(output).digest("hex") } : {}), generatedByText: currentIdentity()?.principal.name ?? args.data.generatedByText };
  if (!(await auditPolicyState(prisma)).required) return prisma.generatedDocument.create({ ...args, data });
  const resource = await qmsScope(qmsRecordId);
  // File hashes are captured by SQL. Neither binary data nor source snapshots
  // are copied into a command receipt.
  const id = await documentCommand(resource.module, resource.scope as { id: string; departmentIds?: string[] },
    { root: qmsRecordId, version: data.recordVersionId ?? null, type: data.documentType, template: data.templateVersionId ?? null, checksum: data.checksum ?? null },
    () => prisma.generatedDocument.create({ ...args, data }));
  return prisma.generatedDocument.findUniqueOrThrow({ where: { id } });
}
