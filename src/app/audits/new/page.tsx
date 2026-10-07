import { AuditForm } from "@/modules/audits/audit-form";
import { getAuditDepartments } from "@/modules/audits/queries";
export const dynamic = "force-dynamic";
export default async function NewAuditPage() {
  return <section className="workspace"><div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Nueva auditoría</h1><p>Guarda un borrador o completa los datos de apertura.</p></div></div><AuditForm departments={await getAuditDepartments()}/></section>;
}
