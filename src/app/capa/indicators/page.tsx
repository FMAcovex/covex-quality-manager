import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { AgingPanel,MonthlyTrendChart,ParetoCard,YearToDateCard } from "@/components/analytics/trend-charts";
import { indicatorsHref,paretoDimension } from "@/lib/qms/analytics/trends";
import { CapaKpiCard,CapaTrend,num,pct } from "@/modules/capa/analytics/components";
import { CAPA_PARETO,type CapaParetoDimension } from "@/modules/capa/analytics/domain";
import { getCapaAnalytics,getCapaBacklog } from "@/modules/capa/analytics/queries";

export const dynamic="force-dynamic";
function p(v:string|string[]|undefined){return Array.isArray(v)?v[0]:v;}

async function CapaIndicatorsPageAuthenticatedContent({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const q=await searchParams;
  const filters={year:p(q.year),department:p(q.department),type:p(q.type),origin:p(q.origin),status:p(q.status)};
  const [d,backlog]=await Promise.all([getCapaAnalytics(filters),getCapaBacklog(filters)]),m=d.current;
  const paretoKeys=Object.keys(CAPA_PARETO) as CapaParetoDimension[];
  const paretoActive=paretoDimension(p(q.pareto),paretoKeys,"department");
  const paretoHref=(key:string)=>indicatorsHref("/capa/indicators",{...filters,year:String(d.selectedYear)},key,"department");
  return <section className="workspace analytics-workspace">
    <div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>CAPA · Indicadores</h1><p>Seguimiento de ejecución, eficacia y tendencias desde PostgreSQL.</p></div><div className="heading-actions"><Link href="/capa" className="button">Ver expedientes</Link></div></div>
    <div className="tabs"><Link className="tab muted" href="/capa">Expedientes</Link><Link className="tab active" href="/capa/indicators">Indicadores</Link></div>
    <form method="get" className="analytics-filter-panel">
      <label><span>Año</span><select name="year" defaultValue={String(d.selectedYear)}>{Array.from(new Set([d.selectedYear,...d.years])).sort((a,b)=>b-a).map((y)=><option key={y}>{y}</option>)}</select></label>
      <label><span>Departamento</span><select name="department" defaultValue={filters.department??""}><option value="">Todos</option>{d.departments.map((x)=><option key={x.id} value={x.id}>{x.code}</option>)}</select></label>
      <label><span>Tipo</span><select name="type" defaultValue={filters.type??""}><option value="">Todas</option><option value="CORRECTIVE">Correctiva</option><option value="PREVENTIVE">Preventiva</option></select></label>
      <label><span>Origen</span><select name="origin" defaultValue={filters.origin??""}><option value="">Todos</option>{d.origins.map((x)=><option key={x}>{x}</option>)}</select></label>
      <label><span>Estado</span><select name="status" defaultValue={filters.status??""}><option value="">Todos</option><option value="OPEN">Abierta</option><option value="CLOSED">Cerrada</option><option value="CANCELLED">Cancelada</option></select></label>
      {paretoActive!=="department"?<input type="hidden" name="pareto" value={paretoActive}/>:null}
      <div className="analytics-filter-actions"><button className="button primary">Aplicar</button><Link className="button" href="/capa/indicators">Limpiar</Link></div>
    </form>
    <div className="analytics-note"><strong>Criterio:</strong> ejecución en plazo = cierre operativo ≤ última fecha prevista de las acciones. La eficacia se evalúa solo cuando existe resultado Conforme/No conforme.</div>
    <div className="kpi-grid primary-kpis">
      <CapaKpiCard title="CAPA abiertas en el año" value={String(m.total)} />
      <CapaKpiCard title="Abiertas actualmente" value={String(m.openCurrent)} />
      <CapaKpiCard title="Ejecución en plazo" value={pct(m.execution.rate)} detail={`${m.execution.inTime} de ${m.execution.total} evaluables`} />
      <CapaKpiCard title="Mediana apertura→ejecución" value={m.execution.medianDays===null?"—":`${num(m.execution.medianDays)} días`} />
      <CapaKpiCard title="Pendientes de eficacia" value={String(m.pendingEffectiveness)} />
    </div>
    <div className="kpi-grid secondary-kpis">
      <CapaKpiCard title="Correctivas" value={String(m.corrective)} />
      <CapaKpiCard title="Preventivas" value={String(m.preventive)} />
      <CapaKpiCard title="Eficacia conforme" value={pct(m.effectiveness.rate)} detail={`${m.effectiveness.conforming} de ${m.effectiveness.evaluated} evaluadas`} />
      <CapaKpiCard title="Eficacia no conforme" value={String(m.effectiveness.nonconforming)} />
      <CapaKpiCard title="Mediana ejecución→eficacia" value={m.effectiveness.medianDaysToEffectiveness===null?"—":`${num(m.effectiveness.medianDaysToEffectiveness)} días`} />
    </div>
    <AgingPanel
      id="capa-backlog-title"
      title="Antigüedad de las CAPA abiertas"
      description="Abiertas a fecha de hoy, sea cual sea su año de apertura. Días naturales desde la apertura. «Prevista superada»: la última fecha prevista de las acciones ya pasó. Los tramos son descriptivos, no plazos del PNT."
      summary={backlog.open}
      columns={[{key:"OVERDUE",label:"Prevista superada",alert:true},{key:"NO_PLAN",label:"Sin fecha prevista"}]}
      counters={[
        {value:backlog.open.overdue,label:"con fecha prevista superada",alert:true},
        {value:backlog.open.followupDue,label:"con seguimiento vencido",alert:true},
        {value:backlog.open.withoutPlan,label:"sin fecha prevista"},
      ]}
      listHref="/capa?status=OPEN"
      listLabel="Ver abiertas en el listado"
      detailHref={(id)=>`/capa/${id}`}
      emptyText="No hay CAPA abiertas con estos filtros."
      noDateText="Las CAPA abiertas no tienen fecha de apertura."
    />
    <AgingPanel
      id="capa-effectiveness-title"
      eyebrow="Eficacia pendiente"
      title="CAPA ejecutadas pendientes de verificar eficacia"
      description="Cerradas operativamente con la eficacia pendiente. Días naturales desde el cierre operativo. El plazo de verificación lo fija cada CAPA; los tramos son descriptivos."
      summary={backlog.effectiveness}
      columns={[{key:"CORRECTIVE",label:"Correctivas"},{key:"PREVENTIVE",label:"Preventivas"}]}
      counters={[]}
      totalLabel="pendientes de eficacia"
      listHref="/capa?status=CLOSED&effectiveness=PENDING"
      listLabel="Ver en el listado"
      detailHref={(id)=>`/capa/${id}`}
      emptyText="No hay CAPA pendientes de verificar eficacia con estos filtros."
      noDateText="Las CAPA pendientes no tienen fecha de cierre operativo."
    />
    <div className="analytics-grid">
      <MonthlyTrendChart series={d.monthlySeries}/>
      <YearToDateCard ytd={d.yearToDate}/>
      <ParetoCard year={d.selectedYear} dimensions={paretoKeys.map((key)=>({key,label:CAPA_PARETO[key],items:d.pareto[key]}))} active={paretoActive} hrefFor={paretoHref} unit="CAPA"/>
    </div>
    <section className="trend-section"><div className="trend-section-heading"><div><p className="eyebrow">Tendencia</p><h2>Últimos 5 años hasta {d.selectedYear}</h2></div></div><CapaTrend trend={d.trend}/></section>
  </section>;
}

export default async function CapaIndicatorsPage(...args: Parameters<typeof CapaIndicatorsPageAuthenticatedContent>) {
  return authorizedPage("src/app/capa/indicators/page.tsx", () => CapaIndicatorsPageAuthenticatedContent(...args), args);
}
