import "server-only";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { prisma } from "@/lib/db";

function dayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function getApplicableFormVersion(
  module: QmsRecordType,
  referenceDate: Date,
) {
  const date = dayStart(referenceDate);
  return prisma.formVersion.findFirst({
    where: {
      module,
      isActive: true,
      status: "ACTIVE",
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
}

export async function getApplicableTemplateVersion(
  module: QmsRecordType,
  documentType: DocumentType,
  referenceDate: Date,
) {
  const date = dayStart(referenceDate);
  return prisma.templateVersion.findFirst({
    where: {
      module,
      documentType,
      isActive: true,
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
}
