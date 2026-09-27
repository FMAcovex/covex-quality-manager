import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChangeControlIndicatorsPage() {
  const [total, open, executed, pendingEfficacy, major, minor] = await Promise.all([
    prisma.changeControl.count(),
    prisma.changeControl.count({ where: { finalStatus: "OPEN" } }),
    prisma.changeControl.count({ where: { executionStatus: "EXECUTED" } }),
    prisma.changeControl.count({ where: { executionStatus: "EXECUTED", effectivenessStatus: "PENDING" } }),
    prisma.changeControl.count({ where: { classification: "MAJOR" } }),
    prisma.changeControl.count({ where: { classification: "MINOR" } }),
  ]);
  return (
    <section className="workspace analytics-workspace">
      <div className="page-heading">
        <div><p className="eyebrow">Controles de Cambios</p><h1>Indicadores</h1><p>Indicadores derivados directamente de los expedientes estructurados.</p></div>
      </div>
      <div className="tabs"><Link className="tab muted" href="/changes">Expedientes</Link><Link className="tab active" href="/changes/indicators">Indicadores</Link></div>
      <div className="kpi-grid primary-kpis">
        <div className="kpi-card"><span className="kpi-title">Total</span><strong className="kpi-value">{total}</strong><span className="kpi-detail">Controles registrados</span></div>
        <div className="kpi-card"><span className="kpi-title">Abiertos</span><strong className="kpi-value">{open}</strong><span className="kpi-detail">Pendientes de cierre efectivo</span></div>
        <div className="kpi-card"><span className="kpi-title">Ejecutados</span><strong className="kpi-value">{executed}</strong><span className="kpi-detail">Acciones finalizadas</span></div>
        <div className="kpi-card caution"><span className="kpi-title">Eficacia pendiente</span><strong className="kpi-value">{pendingEfficacy}</strong><span className="kpi-detail">Ejecutados pendientes de comprobación</span></div>
        <div className="kpi-card"><span className="kpi-title">Mayor / Menor</span><strong className="kpi-value">{major} / {minor}</strong><span className="kpi-detail">Clasificación actual</span></div>
      </div>
      <div className="analytics-note">La comparativa anual y las tendencias de 5 años se alimentarán de esta misma base sin duplicar datos.</div>
    </section>
  );
}
