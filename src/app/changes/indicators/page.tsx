import Link from "next/link";
import { ChangeDistributionCard,ChangeKpiCard,ChangeTrend,num,pct } from "@/modules/change-control/analytics/components";
import { getChangeControlAnalytics } from "@/modules/change-control/analytics/queries";
export const dynamic="force-dynamic";
const p=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
export default async function ChangeIndicatorsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const q=await searchParams;const filters={year:p(q.year),department:p(q.department),classification:p(q.classification),status:p(q.status)};
  const d=await getChangeControlAnalytics(filters),m=d.current;
  return <section className="workspace analytics-workspace">
    <div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Controles de cambios · Indicadores</h1><p>Actividad, ejecución, cierre y tendencias desde PostgreSQL.</p></div><Link href="/changes" className="button">Ver expedientes</Link></div>
    <div className="tabs"><Link className="tab muted" href="/changes">Expedientes</Link><Link className="tab active" href="/changes/indicators">Indicadores</Link></div>
    <form method="get" className="analytics-filter-panel">
      <label><span>Año</span><select name="year" defaultValue={String(d.selectedYear)}>{Array.from(new Set([d.selectedYear,...d.years])).sort((a,b)=>b-a).map((y)=><option key={y}>{y}</option>)}</select></label>
      <label><span>Departamento</span><select name="department" defaultValue={filters.department??""}><option value="">Todos</option>{d.departments.map((x)=><option key={x.id} value={x.id}>{x.code}</option>)}</select></label>
      <label><span>Clasificación</span><select name="classification" defaultValue={filters.classification??""}><option value="">Todas</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option></select></label>
      <label><span>Estado</span><select name="status" defaultValue={filters.status??""}><option value="">Todos</option><option value="OPEN">Abierto</option><option value="CLOSED">Cerrado</option><option value="REJECTED">Rechazado</option><option value="CANCELLED">Cancelado</option></select></label>
      <div className="analytics-filter-actions"><button className="button primary">Aplicar</button><Link className="button" href="/changes/indicators">Limpiar</Link></div>
    </form>
    <div className="analytics-note"><strong>Criterio:</strong> los flujos anuales se asignan por la fecha del evento: solicitud, ejecución o cierre. Los pendientes son una fotografía del estado vigente y no una tendencia histórica reconstruida.</div>
    <div className="kpi-grid primary-kpis">
      <ChangeKpiCard title="Controles iniciados" value={String(m.initiated)}/>
      <ChangeKpiCard title="Controles ejecutados" value={String(m.executed)}/>
      <ChangeKpiCard title="Cerrados tras ejecución" value={String(m.closedAfterExecution)}/>
      <ChangeKpiCard title="% ejecutados en plazo" value={pct(m.inTime.rate)} detail={`${m.inTime.count} de ${m.inTime.evaluated} evaluables`}/>
      <ChangeKpiCard title="Mediana aprobación→ejecución" value={m.medianApprovalToExecution===null?"—":`${num(m.medianApprovalToExecution)} días`}/>
    </div>
    <div className="kpi-grid secondary-kpis">
      <ChangeKpiCard title="Pendientes de ejecución" value={String(m.pendingExecution)}/>
      <ChangeKpiCard title="Ejecutados pendientes de cierre" value={String(m.executedPendingClosure)}/>
      <ChangeKpiCard title="Cerrados sin ejecución" value={String(m.closedWithoutExecution)}/>
      <ChangeKpiCard title="Mediana Menor" value={m.medianMinor===null?"—":`${num(m.medianMinor)} días`}/>
      <ChangeKpiCard title="Mediana Mayor" value={m.medianMajor===null?"—":`${num(m.medianMajor)} días`}/>
    </div>
    <div className="analytics-grid"><ChangeDistributionCard title="Iniciados por departamento" items={m.departments}/><ChangeDistributionCard title="Mayor / Menor" items={m.classifications}/></div>
    <section className="trend-section"><div className="trend-section-heading"><div><p className="eyebrow">Tendencia</p><h2>Últimos 5 años hasta {d.selectedYear}</h2></div></div><ChangeTrend trend={d.trend}/></section>
  </section>;
}
