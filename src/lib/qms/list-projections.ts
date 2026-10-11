import { Prisma } from "@prisma/client";

// Only identity/display metadata; never historical snapshots or document bytes.
export const listRecordIdentity = {
  id: true, businessCode: true, annulledBusinessCode: true, recordType: true, isActive: true,
} satisfies Prisma.QmsRecordSelect;

export const listRecordWithRelations = {
  ...listRecordIdentity,
  sourceRelations: { where: { isActive: true }, select: { targetRecord: { select: listRecordIdentity } } },
  targetRelations: { where: { isActive: true }, select: { relationType: true, sourceRecord: { select: listRecordIdentity } } },
} satisfies Prisma.QmsRecordSelect;

/** General statistics keep the existing administrative scope, independent of list filters/page. */
export function listAdministrativeSql(administrative?: string) {
  return administrative === "ALL" ? Prisma.empty : Prisma.sql`AND q."isActive" = ${administrative !== "ANNULLED"}`;
}
