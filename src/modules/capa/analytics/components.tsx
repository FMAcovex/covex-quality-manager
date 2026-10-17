import type { CapaYearMetrics } from "@/modules/capa/analytics/domain";

export const pct=(v:number|null)=>v===null?"—":`${v.toLocaleString("es-ES",{maximumFractionDigits:1})} %`;
export const num=(v:number|null)=>v===null?"—":v.toLocaleString("es-ES",{maximumFractionDigits:1});

export function CapaKpiCard({title,value,detail}:{title:string;value:string;detail?:string}) {
  return <article className="kpi-card"><span className="kpi-title">{title}</span><strong className="kpi-value">{value}</strong>{detail?<span className="kpi-detail">{detail}</span>:null}</article>;
}
export function CapaTrend({trend}:{trend:CapaYearMetrics[]}) {
  return <article className="chart-card wide-chart"><h2>Resumen anual · últimos 5 años</h2><div className="analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Año</th><th>Total</th><th>Abiertas</th><th>% ejecución en plazo</th><th>Mediana ejecución</th><th>Eficacia conforme</th><th>Pendientes eficacia</th><th>Días ejecución→eficacia</th></tr></thead><tbody>{trend.map((x)=><tr key={x.year} className={!x.dataAvailable?"analytics-no-data":undefined}><td><strong>{x.year}</strong></td>{x.dataAvailable?<><td>{x.total}</td><td>{x.openCurrent}</td><td>{pct(x.execution.rate)}</td><td>{x.execution.medianDays===null?"—":`${num(x.execution.medianDays)} d`}</td><td>{pct(x.effectiveness.rate)}</td><td>{x.pendingEffectiveness}</td><td>{x.effectiveness.medianDaysToEffectiveness===null?"—":`${num(x.effectiveness.medianDaysToEffectiveness)} d`}</td></>:<td colSpan={7}>Sin datos cargados</td>}</tr>)}</tbody></table></div></article>;
}
