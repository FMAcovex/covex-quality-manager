import { rootCauseCategoryLabel } from "@/lib/qms/root-cause-categories";
import { ISHIKAWA_CATEGORIES, causeStatusLabel, type InvestigationTools, type ToolCause } from "../investigation-tools";

const statusClass: Record<ToolCause["status"], string> = { HYPOTHESIS: "warning", DISCARDED: "neutral", CONFIRMED: "conforming" };
const Status = ({ value }: { value: ToolCause["status"] }) => <span className={`badge ${statusClass[value]}`}>{causeStatusLabel(value)}</span>;

function CauseList({ causes, showCategory }: { causes: ToolCause[]; showCategory?: boolean }) {
  return <ul className="investigation-cause-list">
    {causes.map((cause, index) => <li key={index}>
      <Status value={cause.status} /> <span className="prose-value">{cause.text}</span>
      {showCategory && cause.category ? <small className="muted-note"> · {rootCauseCategoryLabel(cause.category, true)}</small> : null}
      {cause.evidence ? <small className="muted-note investigation-evidence">Evidencia: {cause.evidence}</small> : null}
    </li>)}
  </ul>;
}

/** D-123: lectura de las herramientas de análisis en la ficha (no forman parte del Anexo III). */
export function InvestigationToolsSummary({ tools }: { tools: InvestigationTools | null }) {
  if (!tools) return null;
  const ishikawa = tools.causes.filter((cause) => cause.method === "ISHIKAWA");
  const brainstorming = tools.causes.filter((cause) => cause.method === "BRAINSTORMING");
  return <div className="investigation-tools-summary">
    <h3>Herramientas de análisis</h3>
    <p className="muted-note">Material de trabajo de la investigación; no se imprime en el Anexo III.</p>
    {tools.fiveWhys ? <section>
      <h4>5 porqués <Status value={tools.fiveWhys.status} /></h4>
      {tools.fiveWhys.problem ? <p className="prose-value"><strong>Problema:</strong> {tools.fiveWhys.problem}</p> : null}
      {tools.fiveWhys.whys.length ? <ol>{tools.fiveWhys.whys.map((why, index) => <li key={index} className="prose-value">{why || "—"}</li>)}</ol> : null}
    </section> : null}
    {ishikawa.length ? <section>
      <h4>Ishikawa (6M)</h4>
      {ISHIKAWA_CATEGORIES.filter((category) => ishikawa.some((cause) => cause.category === category)).map((category) => <div key={category}>
        <h5>{rootCauseCategoryLabel(category, true)}</h5>
        <CauseList causes={ishikawa.filter((cause) => cause.category === category)} />
      </div>)}
    </section> : null}
    {brainstorming.length ? <section>
      <h4>Brainstorming</h4>
      <CauseList causes={brainstorming} showCategory />
    </section> : null}
  </div>;
}
