import Link from "next/link";
import {
  AnnualSummaryTable,
  DistributionCard,
  KpiCard,
  MonthlyComparison,
  TrendChart,
  deltaLabel,
  formatNumber,
  formatPercent,
} from "@/modules/deviations/analytics/components";
import { getDeviationAnalytics } from "@/modules/deviations/analytics/queries";

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DeviationIndicatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const filters = {
    year: param(query.year),
    department: param(query.department),
    classification: param(query.classification),
    provenance: param(query.provenance),
    capa: param(query.capa),
    status: param(query.status),
  };
  const data = await getDeviationAnalytics(filters);
  const { current, previous, trend, selectedYear } = data;
  const compare = (currentValue: number | null, previousValue: number | null, suffix = "") =>
    previous.dataAvailable
      ? deltaLabel(currentValue, previousValue, suffix)
      : "Año anterior sin datos cargados";

  return (
    <section className="workspace analytics-workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Sistema de Calidad</p>
          <h1>Desviaciones · Indicadores</h1>
          <p>KPI calculados directamente desde los expedientes de la aplicación.</p>
        </div>
        <div className="heading-actions">
          <Link href="/deviations" className="button">Ver expedientes</Link>
        </div>
      </div>

      <div className="tabs">
        <Link className="tab muted" href="/deviations">Expedientes</Link>
        <Link className="tab active" href="/deviations/indicators">Indicadores</Link>
      </div>

      <form method="get" className="analytics-filter-panel">
        <label><span>Año analizado</span><select name="year" defaultValue={String(selectedYear)}>
          {Array.from(new Set([selectedYear, ...data.years])).sort((a,b)=>b-a).map((year)=><option key={year} value={year}>{year}</option>)}
        </select></label>
        <label><span>Departamento</span><select name="department" defaultValue={filters.department ?? ""}>
          <option value="">Todos</option>{data.departments.map((item)=><option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
        </select></label>
        <label><span>Clasificación</span><select name="classification" defaultValue={filters.classification ?? ""}>
          <option value="">Todas</option><option value="CRITICAL">Crítica</option><option value="MAJOR">Mayor</option><option value="MINOR">Menor</option>
        </select></label>
        <label><span>Procedencia / origen</span><select name="provenance" defaultValue={filters.provenance ?? ""}>
          <option value="">Todas</option>{data.provenances.map((value)=><option key={value} value={value}>{value}</option>)}
        </select></label>
        <label><span>CAPA</span><select name="capa" defaultValue={filters.capa ?? ""}>
          <option value="">Todas</option><option value="yes">Con CAPA</option><option value="no">Sin CAPA</option>
        </select></label>
        <label><span>Estado actual</span><select name="status" defaultValue={filters.status ?? ""}>
          <option value="">Todos</option><option value="OPEN">Abiertas</option><option value="CLOSED">Cerradas</option>
        </select></label>
        <div className="analytics-filter-actions">
          <button className="button primary" type="submit">Aplicar filtros</button>
          <Link className="button" href="/deviations/indicators">Limpiar</Link>
        </div>
      </form>

      <div className="analytics-note">
        <strong>Reglas de cómputo:</strong> volumen, área, clasificación, origen, recurrencia, afectación y CAPA usan el año de apertura.
        Cierre ≤30 días y mediana usan el año de cierre. Los porcentajes de recurrencia y afectación excluyen registros no evaluados.
      </div>

      <div className="kpi-grid primary-kpis">
        <KpiCard title="Total abierto en el año" value={String(current.total)} comparison={compare(current.total, previous.total)} />
        <KpiCard
          title="Cierre en ≤30 días"
          value={formatPercent(current.closure.rate)}
          detail={`${current.closure.within30} de ${current.closure.total} cierres evaluables`}
          comparison={compare(current.closure.rate, previous.closure.rate, " pp")}
          caution={current.closure.total === 0}
        />
        <KpiCard
          title="Mediana de cierre"
          value={current.closure.medianDays === null ? "—" : `${formatNumber(current.closure.medianDays)} días`}
          detail={`${current.closure.total} cierres evaluables`}
          comparison={compare(current.closure.medianDays, previous.closure.medianDays, " d")}
        />
        <KpiCard
          title="Recurrencia"
          value={formatPercent(current.recurrence.rate)}
          detail={`${current.recurrence.numerator} de ${current.recurrence.denominator} evaluadas · cobertura ${formatPercent(current.recurrence.coverage)}`}
          comparison={compare(current.recurrence.rate, previous.recurrence.rate, " pp")}
          caution={current.recurrence.missing > 0}
        />
        <KpiCard
          title="Afecta a producto terminado"
          value={formatPercent(current.affectsProduct.rate)}
          detail={`${current.affectsProduct.numerator} de ${current.affectsProduct.denominator} evaluadas · cobertura ${formatPercent(current.affectsProduct.coverage)}`}
          comparison={compare(current.affectsProduct.rate, previous.affectsProduct.rate, " pp")}
          caution={current.affectsProduct.missing > 0}
        />
      </div>

      <div className="kpi-grid secondary-kpis">
        <KpiCard title="Críticas" value={String(current.critical)} comparison={compare(current.critical, previous.critical)} />
        <KpiCard title="Mayores" value={String(current.major)} comparison={compare(current.major, previous.major)} />
        <KpiCard title="Abiertas actualmente" value={String(current.openCurrent)} detail={`Cohorte abierta en ${selectedYear}`} comparison={compare(current.openCurrent, previous.openCurrent)} />
        <KpiCard title="Con CAPA" value={String(current.withCapa)} detail={formatPercent(current.withCapaRate)} comparison={compare(current.withCapaRate, previous.withCapaRate, " pp")} />
        <KpiCard
          title="Datos a revisar"
          value={String(current.data.review)}
          detail={`Completitud KPI: ${formatPercent(current.data.completeness)}`}
          comparison={compare(current.data.completeness, previous.data.completeness, " pp")}
          caution={current.data.review > 0}
        />
      </div>

      <div className="analytics-grid">
        <MonthlyComparison current={current} previous={previous} />
        <DistributionCard title="Desviaciones por área" items={current.areas} />
        <DistributionCard title="Distribución por clasificación" items={current.classifications} />
        <DistributionCard title="Distribución por origen" items={current.origins} />
      </div>

      <section className="trend-section">
        <div className="trend-section-heading">
          <div>
            <p className="eyebrow">Tendencia</p>
            <h2>Últimos 5 años hasta {selectedYear}</h2>
          </div>
          <p>Los años sin datos permanecen visibles para mantener una escala temporal estable.</p>
        </div>
        <div className="trend-grid">
          <TrendChart title="Total de desviaciones" trend={trend} metric="total" />
          <TrendChart title="Cierre ≤30 días" trend={trend} metric="closure" suffix="%" />
          <TrendChart title="Recurrencia" trend={trend} metric="recurrence" suffix="%" />
          <TrendChart title="Mediana de cierre" trend={trend} metric="median" suffix="d" />
        </div>
        <AnnualSummaryTable trend={trend} />
      </section>

      <div className="analytics-footnote">
        <strong>Lectura:</strong> área, clasificación y origen son indicadores descriptivos. Un cambio porcentual aislado no implica por sí mismo mejora o deterioro;
        debe interpretarse junto con el número absoluto de casos, la cobertura del dato y el contexto operativo.
      </div>
    </section>
  );
}
