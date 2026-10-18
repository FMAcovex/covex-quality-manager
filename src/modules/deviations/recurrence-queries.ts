import "server-only";
import { prisma } from "@/lib/db";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { rankSimilar, recurrenceReasonLabels, recurrenceWindowStart, type RecurrenceSource } from "@/modules/deviations/recurrence";

export type SimilarDeviation = { id: string; code: string; issueDate: string | null; reasons: string[] };

/** Desviaciones de los 12 meses anteriores parecidas a esta (D-095); solo ayuda a valorar. */
export async function getSimilarDeviations(record: RecurrenceSource): Promise<SimilarDeviation[]> {
  const until = record.issueDate ?? new Date();
  const candidates = await prisma.deviation.findMany({
    where: {
      id: { not: record.id },
      status: { not: "DRAFT" },
      qmsRecord: { isActive: true },
      issueDate: { gte: recurrenceWindowStart(record.issueDate), lte: until },
    },
    select: {
      id: true, issueDate: true, departmentId: true, provenance: true, finishedProductSystem: true, productLot: true,
      rawOrPackagingMaterial: true, materialLot: true, supplierLot: true, additionalLots: true,
      qmsRecord: { select: { businessCode: true, annulledBusinessCode: true } },
    },
  });
  return rankSimilar(record, candidates).map(({ candidate, reasons }) => ({
    id: candidate.id,
    code: qmsRecordDisplayCode(candidate.qmsRecord),
    issueDate: candidate.issueDate?.toISOString().slice(0, 10) ?? null,
    reasons: reasons.map((reason) => recurrenceReasonLabels[reason]),
  }));
}
