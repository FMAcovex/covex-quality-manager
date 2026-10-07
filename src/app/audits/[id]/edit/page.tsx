import { notFound } from "next/navigation";
import { AuditForm } from "@/modules/audits/audit-form";
import { getAuditDetail, getAuditDepartments } from "@/modules/audits/queries";
import { auditDefaults } from "@/modules/audits/service";
export const dynamic = "force-dynamic";
export default async function EditAuditPage({ params }: { params: Promise<{id:string}> }) {
  const {id} = await params;
  const [audit,departments] = await Promise.all([getAuditDetail(id),getAuditDepartments()]);
  if (!audit) notFound();
  if (!audit.qmsRecord.isActive) return <section className="workspace"><h1>Expediente anulado</h1><p>Reactiva la auditoría desde su ficha antes de editarla.</p></section>;
  if (audit.status === "CLOSED") return <section className="workspace"><h1>Auditoría cerrada</h1><p>El cierre definitivo no reabre la auditoría automáticamente. Consulta informes, versiones, documentos e historial desde su ficha.</p></section>;
  return <section className="workspace"><div className="page-heading"><h1>Editar auditoría</h1></div><AuditForm id={id} defaults={auditDefaults(audit)} departments={departments}/></section>;
}
