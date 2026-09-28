import "server-only";
import { QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getActiveTemplateAssets(module: QmsRecordType) {
  return prisma.templateVersion.findMany({
    where: { module, isActive: true },
    orderBy: [{ documentType: "asc" }, { effectiveFrom: "desc" }],
    select: {
      id: true,
      module: true,
      documentType: true,
      versionCode: true,
      fileName: true,
      filePath: true,
      fileSize: true,
      checksum: true,
      isActive: true,
      effectiveFrom: true,
    },
  });
}
