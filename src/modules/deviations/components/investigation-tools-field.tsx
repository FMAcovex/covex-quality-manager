"use client";
import { useState, type MouseEvent } from "react";
import { rootCauseCategoryLabel } from "@/lib/qms/root-cause-categories";
import {
  CAUSE_STATUSES, ISHIKAWA_CATEGORIES, MAX_TOOL_CAUSES, MAX_WHYS, rootCauseSuggestion,
  type InvestigationTools, type RootCauseSuggestion, type ToolCause,
} from "../investigation-tools";

type Status = ToolCause["status"];
type Row = ToolCause & { uid: number };
type State = { problem: string; whys: string[]; whysStatus: Status; causes: Row[] };

const blankWhys = () => Array.from({ length: MAX_WHYS }, () => "");
let nextUid = 1;

function initialState(tools: InvestigationTools | null | undefined): State {
  const whys = [...(tools?.fiveWhys?.whys ?? []), ...blankWhys()].slice(0, MAX_WHYS);
  return {
    problem: tools?.fiveWhys?.problem ?? "",
    whys,
    whysStatus: tools?.fiveWhys?.status ?? "HYPOTHESIS",
    causes: (tools?.causes ?? []).map((cause) => ({ ...cause, uid: nextUid++ })),
  };
}

/** Lo que viaja en el campo oculto; el servidor vuelve a validarlo y quita las filas vacías. */
function serialize(state: State): InvestigationTools {
  const hasWhys = state.problem.trim() || state.whys.some((why) => why.trim());
  return {
    fiveWhys: hasWhys ? { problem: state.problem, whys: state.whys, status: state.whysStatus } : null,
    causes: state.causes.map(({ method, category, text, evidence, status }) => ({ method, category, text, evidence, status })),
  };
}

function lenientParse(json: string | undefined): InvestigationTools | null {
  if (!json) return null;
  try { return JSON.parse(json) as InvestigationTools; } catch { /* Valor del envío anterior ilegible: se parte de lo guardado. */ return null; }
}

/**
 * D-123: 5 porqués, Ishikawa (6M) y brainstorming dentro de «E. Investigación». Ayudan a ordenar
 * la investigación; no se imprimen en el Anexo III. Solo una causa marcada como confirmada se
 * puede llevar a «Causa raíz», con un clic explícito y para revisar antes de guardar.
 */
export function InvestigationToolsField({ defaultValue, submittedJson, error }: {
  defaultValue?: InvestigationTools | null;
  /** Valor enviado si el guardado anterior no se completó. */
  submittedJson?: string;
  error?: string;
}) {
  const [state, setState] = useState<State>(() => initialState(lenientParse(submittedJson) ?? defaultValue));
  const [message, setMessage] = useState("");
  const hasContent = !!serialize(state).fiveWhys || state.causes.length > 0;
  const full = state.causes.length >= MAX_TOOL_CAUSES;

  const updateCause = (uid: number, patch: Partial<ToolCause>) => setState((current) => ({ ...current, causes: current.causes.map((cause) => cause.uid === uid ? { ...cause, ...patch } : cause) }));
  const removeCause = (uid: number) => setState((current) => ({ ...current, causes: current.causes.filter((cause) => cause.uid !== uid) }));
  const addCause = (method: ToolCause["method"], category: ToolCause["category"]) => setState((current) => ({ ...current, causes: [...current.causes, { method, category, text: "", evidence: "", status: "HYPOTHESIS", uid: nextUid++ }] }));

  // Copia explícita a «Causa raíz»: añade el texto (sin duplicarlo) y marca la categoría y la herramienta.
  function copyToRootCause(suggestion: RootCauseSuggestion | null, event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!suggestion || !form) return;
    const rootCause = form.elements.namedItem("rootCause");
    if (rootCause instanceof HTMLTextAreaElement) {
      const current = rootCause.value.trim();
      if (!current.includes(suggestion.text)) rootCause.value = current ? `${current}\n${suggestion.text}` : suggestion.text;
      rootCause.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const check = (name: string, value: string) => {
      const box = form.querySelector<HTMLInputElement>(`input[type="checkbox"][name="${name}"][value="${value}"]`);
      if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event("change", { bubbles: true })); }
    };
    if (suggestion.category) check("rootCauseCategories", suggestion.category);
    check("investigationMethods", suggestion.method);
    setMessage(`Copiado a «Causa raíz»${suggestion.category ? ` con la categoría ${rootCauseCategoryLabel(suggestion.category, true)}` : ""}. Revisa la redacción antes de guardar.`);
  }

  const statusSelect = (value: Status, onChange: (value: Status) => void, label = "Estado") => (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Status)}>
        {CAUSE_STATUSES.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
  const rootCauseButton = (suggestion: RootCauseSuggestion | null, label = "Usar como causa raíz") => (
    <button type="button" className="button small" disabled={!suggestion} title={suggestion ? undefined : "Solo se puede usar una causa confirmada"} onClick={(event) => copyToRootCause(suggestion, event)}>{label}</button>
  );
  const causeRow = (cause: Row, withCategory: boolean) => (
    <div className={`dynamic-row investigation-cause-row status-${cause.status.toLowerCase()}${withCategory ? " with-category" : ""}`} key={cause.uid}>
      <label className="field">
        <span>{cause.method === "ISHIKAWA" ? "Causa posible *" : "Idea / causa posible *"}</span>
        <textarea rows={2} value={cause.text} maxLength={1000} onChange={(e) => updateCause(cause.uid, { text: e.target.value })} />
      </label>
      {withCategory ? (
        <label className="field">
          <span>Categoría (6M)</span>
          <select value={cause.category ?? ""} onChange={(e) => updateCause(cause.uid, { category: (e.target.value || null) as ToolCause["category"] })}>
            <option value="">Sin categoría</option>
            {ISHIKAWA_CATEGORIES.map((category) => <option key={category} value={category}>{rootCauseCategoryLabel(category, true)}</option>)}
          </select>
        </label>
      ) : null}
      <label className="field">
        <span>Evidencia / comprobación</span>
        <textarea rows={2} value={cause.evidence} maxLength={1000} onChange={(e) => updateCause(cause.uid, { evidence: e.target.value })} />
      </label>
      {statusSelect(cause.status, (status) => updateCause(cause.uid, { status }))}
      <div className="investigation-row-actions">
        {rootCauseButton(rootCauseSuggestion(cause))}
        <button type="button" className="button danger small" onClick={() => removeCause(cause.uid)}>Quitar</button>
      </div>
    </div>
  );

  const whySuggestion = rootCauseSuggestion({ problem: state.problem, whys: state.whys, status: state.whysStatus });
  return (
    <details className="field full investigation-tools" open={hasContent || !!error}>
      <summary>Herramientas de análisis (opcional): 5 porqués, Ishikawa (6M) y brainstorming</summary>
      <input type="hidden" name="investigationToolsJson" value={JSON.stringify(serialize(state))} />
      <p className="muted-note">Ayudan a ordenar la investigación y quedan en el expediente, pero no se imprimen en el Anexo III. Cada causa es una hipótesis hasta que la marques como descartada o confirmada. «Usar como causa raíz» solo está disponible para lo confirmado: copia el texto a «Causa raíz» y marca su categoría; revisa la redacción antes de guardar.</p>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <p className="visually-hidden" role="status" aria-live="polite">{message}</p>
      {message ? <p className="investigation-tools-message" aria-hidden="true">{message}</p> : null}

      <fieldset className="investigation-tool">
        <legend>5 porqués</legend>
        <label className="field">
          <span>Problema</span>
          <textarea rows={2} value={state.problem} maxLength={1000} onChange={(e) => setState((current) => ({ ...current, problem: e.target.value }))} />
        </label>
        <ol className="five-whys-list">
          {state.whys.map((why, index) => (
            <li key={index}>
              <label className="field">
                <span>¿Por qué? {index + 1}</span>
                <input value={why} maxLength={1000} onChange={(e) => setState((current) => ({ ...current, whys: current.whys.map((item, i) => i === index ? e.target.value : item) }))} />
              </label>
            </li>
          ))}
        </ol>
        <div className="investigation-row-actions">
          {statusSelect(state.whysStatus, (whysStatus) => setState((current) => ({ ...current, whysStatus })), "Estado del último porqué")}
          {rootCauseButton(whySuggestion, "Usar el último porqué como causa raíz")}
        </div>
      </fieldset>

      <fieldset className="investigation-tool">
        <legend>Ishikawa (6M)</legend>
        {ISHIKAWA_CATEGORIES.map((category) => (
          <div className="ishikawa-category" key={category}>
            <div className="ishikawa-category-head">
              <h4>{rootCauseCategoryLabel(category)}</h4>
              <button type="button" className="button small" disabled={full} onClick={() => addCause("ISHIKAWA", category)}>+ Añadir causa en {rootCauseCategoryLabel(category, true)}</button>
            </div>
            <div className="dynamic-list">
              {state.causes.filter((cause) => cause.method === "ISHIKAWA" && cause.category === category).map((cause) => causeRow(cause, false))}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="investigation-tool">
        <legend>Brainstorming</legend>
        <div className="dynamic-list">
          {state.causes.filter((cause) => cause.method === "BRAINSTORMING").map((cause) => causeRow(cause, true))}
          <div><button type="button" className="button small" disabled={full} onClick={() => addCause("BRAINSTORMING", null)}>+ Añadir idea</button></div>
        </div>
      </fieldset>
    </details>
  );
}
