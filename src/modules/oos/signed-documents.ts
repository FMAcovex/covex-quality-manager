import { RecordVersionDocumentKind, type Prisma } from "@prisma/client";

// D-088, OOS-4: signed Anexo III / IV PDFs of an OOS, kept as received originals.
export type OosSignedAnnex = "annex-iii" | "annex-iv";

export const oosSignedAnnexes = {
  "annex-iii": { kind: RecordVersionDocumentKind.OOS_ANNEX_III_SIGNED, label: "Anexo III", fieldPath: "__oos_annex_iii_signed__", fallback: "Anexo_III_OOS_firmado.pdf" },
  "annex-iv": { kind: RecordVersionDocumentKind.OOS_ANNEX_IV_SIGNED, label: "Anexo IV", fieldPath: "__oos_annex_iv_signed__", fallback: "Anexo_IV_OOS_firmado.pdf" },
} as const;

const iso = (value: Date | null) => (value ? value.toISOString() : null);

type OosSnapshotSource = Prisma.OosRecordGetPayload<{ include: { qmsRecord: { include: { sourceRelations: { include: { targetRecord: true } } } } } }>;

/**
 * Technical snapshot the signed original is bound to. OOS has no functional
 * versions: version 0 is refreshed to the record as it stands when a PDF is received.
 */
export function serializeOosVersion(record: OosSnapshotSource) {
  const { qmsRecord, createdAt, updatedAt, issueDate, oosDate, phaseIIssuedAt, phaseIApprovedAt, phaseIIIssueDate, phaseIIIssuedAt, closedAt, ...fields } = record;
  void createdAt; void updatedAt;
  return {
    recordType: "OOS",
    businessCode: qmsRecord.businessCode ?? null,
    year: qmsRecord.year ?? null,
    oos: { ...fields, issueDate: iso(issueDate), oosDate: iso(oosDate), phaseIIssuedAt: iso(phaseIIssuedAt), phaseIApprovedAt: iso(phaseIApprovedAt), phaseIIIssueDate: iso(phaseIIIssueDate), phaseIIIssuedAt: iso(phaseIIIssuedAt), closedAt: iso(closedAt) },
    relations: qmsRecord.sourceRelations.filter((relation) => relation.isActive).map((relation) => ({ id: relation.id, targetRecordId: relation.targetRecordId, recordType: relation.targetRecord.recordType, businessCode: relation.targetRecord.businessCode ?? relation.targetRecord.annulledBusinessCode })),
  };
}
