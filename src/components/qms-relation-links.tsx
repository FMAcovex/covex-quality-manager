import Link from "next/link";
import { qmsRecordHref, qmsRecordTypeLabel, type LinkableQmsRecord } from "@/lib/qms/links";

type Relation = {
  sourceRecord?: LinkableQmsRecord;
  targetRecord?: LinkableQmsRecord;
};

export function QmsRelationLinks({
  sourceRelations,
  targetRelations,
  empty = "—",
}: {
  sourceRelations: Relation[];
  targetRelations: Relation[];
  empty?: string;
}) {
  const records = [
    ...sourceRelations.map((item) => item.targetRecord).filter(Boolean),
    ...targetRelations.map((item) => item.sourceRecord).filter(Boolean),
  ] as LinkableQmsRecord[];

  const unique = Array.from(new Map(records.map((record) => [record.id, record])).values());
  if (!unique.length) return <>{empty}</>;

  return (
    <div className="qms-link-list">
      {unique.map((record) => {
        const href = qmsRecordHref(record);
        const label = record.businessCode || qmsRecordTypeLabel(record.recordType);
        return href ? (
          <Link
            key={record.id}
            className="qms-record-link"
            href={href}
            title={qmsRecordTypeLabel(record.recordType)}
          >
            {label}
          </Link>
        ) : (
          <span key={record.id} className="qms-record-link disabled-link">
            {label}
          </span>
        );
      })}
    </div>
  );
}
