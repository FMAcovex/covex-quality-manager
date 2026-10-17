import { ROOT_CAUSE_PARETO_VIEW } from "@/lib/qms/root-cause-categories";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { AgingPanel,MonthlyTrendChart,ParetoCard,YearToDateCard } from "@/components/analytics/trend-charts";
import { indicatorsHref,paretoDimension } from "@/lib/qms/analytics/trends";
import { CapaKpiCard } from "@/modules/capa/analytics/components";
import { COMPLAINT_PARETO,type ComplaintParetoDimension } from "@/modules/complaints/analytics/domain";
import { getComplaintAnalytics,getComplaintBacklog } from "@/modules/complaints/analytics/queries";
export const dynamic="force-dynamic";
const p=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
const pct=(v:number|null)=>v===null?"—":`${v.toLocaleString("es-ES",{maximumFractionDigits:1})} %`;
async function ComplaintIndicatorsPageAuthenticatedContent({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams,f={year:p(q.year),department:p(q.department),type:p(q.type),classification:p(q.classification),status:p(q.status)};const [d,backlog]=await Promise.all([getComplaintAnalytics(f),getComplaintBacklog(f)]),m=d.current;
 const days=(v:number|null)=>v===null?"—":`${v.toLocaleString("es-ES")} días`;
 const paretoKeys=Object.keys(COMPLAINT_PARETO) as ComplaintParetoDimension[];
 const paretoActive=paretoDimension(p(q.pareto),paretoKeys,"category");
 const paretoHref=(key:string)=>indicatorsHref("/complaints/indicators",{...f,year:String(d.selectedYear)},key,"category");
 return <section className="workspace analytics-workspace"><div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Reclamaciones · Indicadores</h1><p>Volumen, recurrencia, tiempos, origen y tendencia calculados desde los expedientes.</p></div><div className="heading-actions"><Link className="button" href="/complaints">Ver expedientes</Link></div></div>
 <div className="tabs"><Link className="tab muted" href="/complaints">Expedientes</Link><Link className="tab active" href="/complaints/indicators">Indicadores</Link></div>
 <form method="get" className="analytics-filter-panel"><label><span>Año</span><select name="year" defaultValue={String(d.selectedYear)}>{Array.from(new Set([d.selectedYear,...d.years])).sort((a,b)=>b-a).map(y=><option key={y}>{y}</option>)}</select></label><label><span>Departamento</span><select name="department" defaultValue={f.department??""}><option value="">Todos</option>{d.departments.map(x=><option key={x.id} value={x.id}>{x.code}</option>)}</select></label><label><span>Tipo</span><select name="type" defaultValue={f.type??""}><option value="">Todos</option><option value="CUSTOMER">De cliente</option><option value="PROVIDER">A proveedor</option></select></label><label><span>Clasificación</span><select name="classification" defaultValue={f.classification??""}><option value="">Todas</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option><option value="NO_GMP_IMPACT">Sin impacto GMP</option></select></label><label><span>Estado</span><select name="status" defaultValue={f.status??""}><option value="">Todos</option><option value="OPEN">Abiertas</option><option value="CLOSED">Cerradas</option></select></label>{paretoActive!=="category"?<input type="hidden" name="pareto" value={paretoActive}/>:null}<div className="analytics-filter-actions"><button className="button primary">Aplicar</button><Link className="button" href="/complaints/indicators">Limpiar</Link></div></form>
 <div className="kpi-grid primary-kpis"><CapaKpiCard title="Reclamaciones del año" value={String(m.total)}/><CapaKpiCard title="Abiertas actualmente" value={String(m.open)}/><CapaKpiCard title="Pendientes Parte II" value={String(m.pendingPartII)}/><CapaKpiCard title="Eficacia pendiente" value={String(m.pendingEffectiveness)}/><CapaKpiCard title="Seguimientos vencidos" value={String(m.overdueFollowup)}/></div>
 <div className="kpi-grid secondary-kpis"><CapaKpiCard title="Cerradas en el año" value={String(m.closed)}/><CapaKpiCard title="De cliente / a proveedor" value={`${m.customer} / ${m.provider}`}/><CapaKpiCard title="Recurrencia" value={pct(m.recurrent.rate)} detail={`${m.recurrent.count} de ${m.recurrent.total} evaluadas`}/><CapaKpiCard title="Mediana apertura→cierre" value={days(m.medianClosure)}/><CapaKpiCard title="Mediana recepción→respuesta" value={days(m.medianResponse)} detail="Respuestas emitidas en el año"/></div>
 <AgingPanel
  id="complaint-backlog-title"
  title="Antigüedad de las reclamaciones abiertas"
  description="Abiertas a fecha de hoy, sea cual sea su año de apertura. Días naturales desde la fecha de apertura. Los tramos son descriptivos, no plazos del PNT."
  summary={backlog}
  columns={[{key:"CRITICAL",label:"Críticas",alert:true},{key:"MAJOR",label:"Mayores"}]}
  counters={[
   {value:backlog.followupDue,label:"con seguimiento vencido",alert:true},
   {value:backlog.pendingPartII,label:"pendientes de decidir Parte II"},
   {value:backlog.pendingEffectiveness,label:"con eficacia pendiente"},
  ]}
  listHref="/complaints?status=OPEN"
  listLabel="Ver abiertas en el listado"
  detailHref={(id)=>`/complaints/${id}`}
  emptyText="No hay reclamaciones abiertas con estos filtros."
  noDateText="Las reclamaciones abiertas no tienen fecha de apertura."
 />
 <div className="analytics-grid">
  <MonthlyTrendChart series={d.monthlySeries} noun={{one:"reclamación",many:"reclamaciones"}}/>
  <YearToDateCard ytd={d.yearToDate}/>
  <ParetoCard
   year={d.selectedYear}
   dimensions={paretoKeys.map(key=>({
    key,label:COMPLAINT_PARETO[key],items:d.pareto[key],
    ...(key==="category"||key==="source"?{unit:"menciones",note:`Una reclamación puede tener varias ${key==="category"?"categorías":"fuentes"}: el porcentaje es sobre el total marcado.`}:{}),
    ...(key==="rootCause"?ROOT_CAUSE_PARETO_VIEW:{}),
   }))}
   active={paretoActive}
   hrefFor={paretoHref}
   unit="reclamaciones"
  />
 </div>
 <section className="trend-section"><div className="trend-section-heading"><div><p className="eyebrow">Tendencia</p><h2>Últimos 5 años hasta {d.selectedYear}</h2></div></div><article className="chart-card wide-chart"><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Año</th><th>Total</th><th>Abiertas</th><th>Cliente</th><th>Proveedor</th><th>Críticas</th><th>Recurrencia</th><th>Mediana cierre</th><th>Mediana respuesta</th></tr></thead><tbody>{d.trend.map(x=><tr key={x.year} className={!x.dataAvailable?"analytics-no-data":undefined}><td><strong>{x.year}</strong></td>{x.dataAvailable?<><td>{x.total}</td><td>{x.open}</td><td>{x.customer}</td><td>{x.provider}</td><td>{x.critical}</td><td>{pct(x.recurrent.rate)}</td><td>{x.medianClosure===null?"—":`${x.medianClosure} d`}</td><td>{x.medianResponse===null?"—":`${x.medianResponse.toLocaleString("es-ES")} d`}</td></>:<td colSpan={8}>Sin datos cargados</td>}</tr>)}</tbody></table></div></article></section>
 </section>;
}

export default async function ComplaintIndicatorsPage(...args: Parameters<typeof ComplaintIndicatorsPageAuthenticatedContent>) {
  return authorizedPage("src/app/complaints/indicators/page.tsx", () => ComplaintIndicatorsPageAuthenticatedContent(...args), args);
}
