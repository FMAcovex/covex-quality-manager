import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { AgingPanel,MonthlyTrendChart,ParetoCard,YearToDateCard } from "@/components/analytics/trend-charts";
import { indicatorsHref,paretoDimension } from "@/lib/qms/analytics/trends";
import { CapaKpiCard } from "@/modules/capa/analytics/components";
import { RETURN_PARETO,type ReturnParetoDimension } from "@/modules/returns/analytics/domain";
import { getReturnAnalytics,getReturnBacklog } from "@/modules/returns/analytics/queries";
export const dynamic="force-dynamic";
const p=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;
async function ReturnIndicatorsPageAuthenticatedContent({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams,f={year:p(q.year),department:p(q.department),type:p(q.type),decision:p(q.decision),status:p(q.status)};const [d,backlog]=await Promise.all([getReturnAnalytics(f),getReturnBacklog(f)]),m=d.current;
 const days=(v:number|null)=>v===null?"—":`${v.toLocaleString("es-ES")} días`;
 const paretoKeys=Object.keys(RETURN_PARETO) as ReturnParetoDimension[];
 const paretoActive=paretoDimension(p(q.pareto),paretoKeys,"type");
 const paretoHref=(key:string)=>indicatorsHref("/returns/indicators",{...f,year:String(d.selectedYear)},key,"type");
 return <section className="workspace analytics-workspace"><div className="page-heading"><div><p className="eyebrow">Sistema de Calidad</p><h1>Devoluciones · Indicadores</h1><p>Volumen, decisión, tiempos, origen y tendencia desde los expedientes.</p></div><div className="heading-actions"><Link className="button" href="/returns">Ver expedientes</Link></div></div>
 <div className="tabs"><Link className="tab muted" href="/returns">Expedientes</Link><Link className="tab active" href="/returns/indicators">Indicadores</Link></div>
 <form method="get" className="analytics-filter-panel"><label><span>Año</span><select name="year" defaultValue={String(d.selectedYear)}>{Array.from(new Set([d.selectedYear,...d.years])).sort((a,b)=>b-a).map(y=><option key={y}>{y}</option>)}</select></label><label><span>Área</span><select name="department" defaultValue={f.department??""}><option value="">Todas</option>{d.departments.map(x=><option key={x.id} value={x.id}>{x.code}</option>)}</select></label><label><span>Tipo</span><select name="type" defaultValue={f.type??""}><option value="">Todos</option><option value="COMMERCIAL">Comercial</option><option value="COMPLAINT">Reclamación</option><option value="RECALL">Retirada</option><option value="EXPIRY">Caducidad</option><option value="TRANSPORT">Transporte</option><option value="OTHER">Otra</option></select></label><label><span>Decisión</span><select name="decision" defaultValue={f.decision??""}><option value="">Todas</option><option value="PENDING">Pendiente</option><option value="ACCEPTED">Aceptada</option><option value="REJECTED">Rechazada</option></select></label><label><span>Estado</span><select name="status" defaultValue={f.status??""}><option value="">Todos</option><option value="OPEN">Abiertas</option><option value="CLOSED">Cerradas</option></select></label>{paretoActive!=="type"?<input type="hidden" name="pareto" value={paretoActive}/>:null}<div className="analytics-filter-actions"><button className="button primary">Aplicar</button><Link className="button" href="/returns/indicators">Limpiar</Link></div></form>
 <div className="kpi-grid primary-kpis"><CapaKpiCard title="Devoluciones del año" value={String(m.total)}/><CapaKpiCard title="Abiertas actualmente" value={String(m.open)}/><CapaKpiCard title="Aceptadas" value={String(m.accepted)}/><CapaKpiCard title="Rechazadas" value={String(m.rejected)}/><CapaKpiCard title="Decisión pendiente" value={String(m.pending)}/></div>
 <div className="kpi-grid secondary-kpis"><CapaKpiCard title="Cerradas en el año" value={String(m.closed)}/><CapaKpiCard title="Mediana comunicación→decisión" value={days(m.medianDecision)} detail="Decisiones tomadas en el año"/><CapaKpiCard title="Mediana comunicación→cierre" value={days(m.medianClosure)}/></div>
 <AgingPanel
  id="return-backlog-title"
  title="Antigüedad de las devoluciones abiertas"
  description="Abiertas a fecha de hoy, sea cual sea su año. Días naturales desde la fecha de comunicación. Los tramos son descriptivos, no plazos del PNT."
  summary={backlog}
  columns={[{key:"PENDING_DECISION",label:"Decisión pendiente",alert:true}]}
  counters={[
   {value:backlog.pendingDecision,label:"con decisión pendiente",alert:true},
   {value:backlog.followupDue,label:"con seguimiento vencido",alert:true},
  ]}
  listHref="/returns?status=OPEN"
  listLabel="Ver abiertas en el listado"
  detailHref={(id)=>`/returns/${id}`}
  emptyText="No hay devoluciones abiertas con estos filtros."
  noDateText="Las devoluciones abiertas no tienen fecha de comunicación."
 />
 <div className="analytics-grid">
  <MonthlyTrendChart series={d.monthlySeries} noun={{one:"devolución",many:"devoluciones"}} basis="Por fecha de comunicación."/>
  <YearToDateCard ytd={d.yearToDate}/>
  <ParetoCard
   year={d.selectedYear}
   dimensions={paretoKeys.map(key=>({
    key,label:RETURN_PARETO[key],items:d.pareto[key],
    ...(key==="productType"?{unit:"productos",note:"Una devolución puede incluir varios productos: el porcentaje es sobre el total de productos."}:{}),
   }))}
   active={paretoActive}
   hrefFor={paretoHref}
   unit="devoluciones"
  />
 </div>
 <section className="trend-section"><div className="trend-section-heading"><div><p className="eyebrow">Tendencia</p><h2>Últimos 5 años hasta {d.selectedYear}</h2></div></div><article className="chart-card wide-chart"><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Año</th><th>Total</th><th>Abiertas</th><th>Aceptadas</th><th>Rechazadas</th><th>Pendientes</th><th>Mediana decisión</th><th>Mediana cierre</th></tr></thead><tbody>{d.trend.map(x=><tr key={x.year} className={!x.dataAvailable?"analytics-no-data":undefined}><td><strong>{x.year}</strong></td>{x.dataAvailable?<><td>{x.total}</td><td>{x.open}</td><td>{x.accepted}</td><td>{x.rejected}</td><td>{x.pending}</td><td>{x.medianDecision===null?"—":`${x.medianDecision.toLocaleString("es-ES")} d`}</td><td>{x.medianClosure===null?"—":`${x.medianClosure} d`}</td></>:<td colSpan={7}>Sin datos cargados</td>}</tr>)}</tbody></table></div></article></section>
 </section>;
}

export default async function ReturnIndicatorsPage(...args: Parameters<typeof ReturnIndicatorsPageAuthenticatedContent>) {
  return authorizedPage("src/app/returns/indicators/page.tsx", () => ReturnIndicatorsPageAuthenticatedContent(...args), args);
}
