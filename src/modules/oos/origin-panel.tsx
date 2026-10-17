import Link from "next/link";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { getOosOrigins } from "./queries";

/** OOS de origen de una CAPA o una desviación; la relación se gestiona desde el OOS (D-088). */
export async function OosOriginPanel({ targetRecordId }: { targetRecordId: string }) {
  const origins = await getOosOrigins(targetRecordId);
  if (!origins.length) return null;
  return <section className="audit-origin-panel"><h3>OOS de origen</h3><div className="relation-list">{origins.map((relation) => {
    const oos = relation.sourceRecord.oosRecord;
    return <article className="relation-card" key={relation.id}>
      {oos ? <Link href={`/oos/${oos.id}`}><strong>{qmsRecordDisplayCode(relation.sourceRecord, "OOS")}{!relation.sourceRecord.isActive ? " · Anulado" : ""}</strong></Link> : <strong>{qmsRecordDisplayCode(relation.sourceRecord, "OOS")}</strong>}
      {oos?.materialName ? <span>{oos.materialName}</span> : null}
      <small>Relación QMS canónica OOS → expediente. Se gestiona desde el OOS.</small>
    </article>;
  })}</div></section>;
}
