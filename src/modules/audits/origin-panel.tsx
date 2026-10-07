import Link from "next/link";
import { getAuditOrigins } from "./finding-queries";
import { auditAnchor } from "./finding-domain";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
export async function AuditOriginPanel({targetRecordId}: {targetRecordId:string}) {
  const origins = await getAuditOrigins(targetRecordId);
  if (!origins.length) return null;
  return <section className="audit-origin-panel"><h3>Auditorías de origen</h3><div className="relation-list">{origins.map(r => <article className="relation-card" key={r.id}><Link href={`/audits/${r.sourceRecord.audit!.id}`}><strong>{qmsRecordDisplayCode(r.sourceRecord,r.sourceRecord.audit?.externalReference || r.sourceRecord.audit?.title || "Auditoría")}{!r.sourceRecord.isActive ? " · Anulada" : ""}</strong></Link>{r.auditFindingRelations.map(a => <Link key={a.id} href={`/audits/${r.sourceRecord.audit!.id}?tab=findings&retired=1#${auditAnchor("finding",a.finding.id)}`}>{a.finding.reference}{!a.finding.isActive ? " · Retirado" : ""}</Link>)}<small>Relación QMS canónica Auditoría → expediente.</small></article>)}</div></section>;
}
