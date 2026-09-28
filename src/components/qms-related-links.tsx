import Link from "next/link";
import {
  qmsRecordHref,
  qmsRecordTypeLabel,
  type RelatedQmsRecord,
} from "@/lib/qms/record-links";

export function QmsRelatedLinks({
  records,
  empty = "—",
}: {
  records: RelatedQmsRecord[];
  empty?: string;
}) {
  if (!records.length) return <>{empty}</>;

  return (
    <div className="relation-chips">
      {records.map((record) => {
        const href = qmsRecordHref(record);
        const label = record.businessCode ?? qmsRecordTypeLabel(record.recordType);
        return href ? (
          <Link
            key={record.id}
            className="relation-chip"
            href={href}
            title={qmsRecordTypeLabel(record.recordType)}
          >
            {label}
          </Link>
        ) : (
          <span key={record.id} className="relation-chip">
            {label}
          </span>
        );
      })}
    </div>
  );
}
