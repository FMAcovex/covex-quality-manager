"use client";
import { deviationVersionLabel } from "@/modules/deviations/version-mode";
import { deviationProvenanceOptions } from "@/modules/deviations/domain";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import type {
  CapaPlanInput,
  DepartmentOption,
  DeviationFormDefaults,
  FormState,
  ImmediateActionInput,
} from "@/modules/deviations/types";

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

const emptyAction: ImmediateActionInput = { description: "", executedBy: "", executedAt: "" };
const emptyCapa: CapaPlanInput = {
  actionType: "CORRECTIVE",
  description: "",
  plannedExecutionDate: "",
  responsible: "",
};

type OriginType =
  | ""
  | "FINISHED_PRODUCT_SYSTEM"
  | "CLIENT"
  | "RAW_PACKAGING_MATERIAL"
  | "SUPPLIER"
  | "EQUIPMENT_LINE"
  | "OTHER";

function inferOrigin(defaults: DeviationFormDefaults): OriginType {
  if (defaults.provenance && [
    "FINISHED_PRODUCT_SYSTEM",
    "CLIENT",
    "RAW_PACKAGING_MATERIAL",
    "SUPPLIER",
    "EQUIPMENT_LINE",
    "OTHER",
  ].includes(defaults.provenance)) return defaults.provenance as OriginType;
  if (defaults.finishedProductSystem || defaults.productLot || defaults.lotSize || defaults.affectedQuantity) return "FINISHED_PRODUCT_SYSTEM";
  if (defaults.client) return "CLIENT";
  if (defaults.rawOrPackagingMaterial || defaults.materialLot || defaults.materialLotSize || defaults.materialAffectedQuantity) return "RAW_PACKAGING_MATERIAL";
  if (defaults.supplier || defaults.supplierLot) return "SUPPLIER";
  if (defaults.affectedEquipmentLine) return "EQUIPMENT_LINE";
  if (defaults.otherOrigin) return "OTHER";
  return "";
}

function FieldIssue({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <small className="field-error">{messages[0]}</small>;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  span = "",
  required = false,
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  span?: string;
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field ${span} ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} aria-invalid={issues?.length ? true : undefined} />
      <FieldIssue messages={issues} />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  help,
  required = false,
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  help?: string;
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field full ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      {help ? <small className="muted-note">{help}</small> : null}
      <textarea name={name} defaultValue={defaultValue ?? ""} required={required} aria-invalid={issues?.length ? true : undefined} />
      <FieldIssue messages={issues} />
    </label>
  );
}

function TriStateSelect({
  label,
  name,
  defaultValue,
  required = false,
  issues,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  issues?: string[];
}) {
  return (
    <label className={`field ${issues?.length ? "has-error" : ""}`}>
      <span>{label}{required ? " *" : ""}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        aria-invalid={issues?.length ? true : undefined}
      >
        <option value="">No informado</option>
        <option value="YES">Sí</option>
        <option value="NO">No</option>
        <option value="NA">N/A</option>
      </select>
      <FieldIssue messages={issues} />
    </label>
  );
}

export function DeviationForm({
  action,
  departments,
  defaults = {},
  mode,
  deviationId,
  cancelHref,
  currentVersionSequence = 0,
}: {
  action: FormAction;
  departments: DepartmentOption[];
  defaults?: DeviationFormDefaults;
  mode: "create" | "edit";
  deviationId?: string;
  cancelHref?: string;
  currentVersionSequence?: number;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const submitted = state.submittedValues;
  const formDefaults = new Proxy(defaults, {
    get(target, prop) {
      if (typeof prop !== "string") return Reflect.get(target, prop);
      const submittedValue = submitted?.[prop];
      if (submittedValue !== undefined) return submittedValue;
      return Reflect.get(target, prop);
    },
  }) as DeviationFormDefaults;
  const [actions, setActions] = useState<ImmediateActionInput[]>(formDefaults.immediateActions ?? []);
  const [capas, setCapas] = useState<CapaPlanInput[]>(formDefaults.capaPlans ?? []);
  const [origin, setOrigin] = useState<OriginType>(() => inferOrigin(formDefaults));
  const [recordStatus, setRecordStatus] = useState<"DRAFT" | "OPEN" | "CLOSED">(formDefaults.status ?? (mode === "create" ? "DRAFT" : "OPEN"));
  const [businessCode, setBusinessCode] = useState(formDefaults.businessCode ?? "");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(formDefaults.departmentId ?? "");
  const [issueDateValue, setIssueDateValue] = useState(formDefaults.issueDate ?? "");
  const [suggestedCode, setSuggestedCode] = useState("");
  const [openingAttempted, setOpeningAttempted] = useState(false);
  const issues = state.fieldIssues ?? {};

  useEffect(() => {
    if (formDefaults.businessCode && formDefaults.status !== "DRAFT") {
      setSuggestedCode("");
      return;
    }

    const departmentId = selectedDepartmentId;
    const departmentCode = departments.find((item) => item.id === departmentId)?.code ?? "";
    const issueYear =
      /^\\d{4}-/.test(issueDateValue)
        ? Number(issueDateValue.slice(0, 4))
        : new Date().getFullYear();

    if (!departmentId) {
      setSuggestedCode("");
      return;
    }

    if (
      formDefaults.status === "DRAFT" &&
      formDefaults.businessCode &&
      departmentCode &&
      formDefaults.businessCode.startsWith(`D/${departmentCode}/`) &&
      formDefaults.businessCode.endsWith(`/${issueYear}`)
    ) {
      setSuggestedCode(formDefaults.businessCode);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/deviations/code-suggestion?departmentId=${encodeURIComponent(departmentId)}&year=${issueYear}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se ha podido calcular la sugerencia.");
        setSuggestedCode(data.suggestion || "");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSuggestedCode("");
      });
    return () => controller.abort();
  }, [departments, formDefaults.businessCode, formDefaults.status, selectedDepartmentId, issueDateValue]);

  function updateAction(index: number, patch: Partial<ImmediateActionInput>) {
    setActions((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateCapa(index: number, patch: Partial<CapaPlanInput>) {
    setCapas((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <form
      key={state.formRevision ?? 0}
      action={formAction}
      className={`form-stack ${openingAttempted ? "show-required-errors" : ""}`}
      onInvalid={() => setOpeningAttempted(true)}
    >
      <input type="hidden" name="immediateActionsJson" value={JSON.stringify(actions)} />
      <input type="hidden" name="capaPlansJson" value={JSON.stringify(capas)} />
      <input type="hidden" name="processEquipmentSystem" value={formDefaults.processEquipmentSystem ?? ""} />

      {state.error ? (
        <div className="form-errors">
          <strong>{state.error}</strong>
          {state.fieldErrors?.length ? (
            <ul>{state.fieldErrors.map((error) => <li key={error}>{error}</li>)}</ul>
          ) : null}
        </div>
      ) : null}

      <section className="form-section">
        <h2>Identificación</h2>
        <p className="section-help">Datos que identifican el expediente y su registro inicial.</p>
        <div className="form-grid">
          <label className={`field ${issues.businessCode?.length ? "has-error" : ""}`}>
            <span>Codificación</span>
            <input
              name="businessCode"
              value={businessCode}
              onChange={(e) => setBusinessCode(e.target.value)}
              placeholder={suggestedCode || "Selecciona departamento para ver la sugerencia"}
              readOnly={Boolean(formDefaults.businessCode) && formDefaults.status !== "DRAFT"}
              aria-invalid={issues.businessCode?.length ? true : undefined}
            />
            <small className="muted-note">
              {formDefaults.businessCode && formDefaults.status !== "DRAFT"
                ? "La codificación queda fijada una vez abierta la desviación."
                : suggestedCode
                  ? <>Sugerencia correlativa: <button type="button" className="link-button-inline" onClick={() => setBusinessCode(suggestedCode)}>{suggestedCode}</button></>
                  : "Formato: D/XX-NN/ZZZ/YYYY."}
            </small>
            <FieldIssue messages={issues.businessCode} />
          </label>
          <label className={`field ${issues.departmentId?.length ? "has-error" : ""}`}>
            <span>Departamento *</span>
            <select
              name="departmentId"
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              required
              aria-invalid={issues.departmentId?.length ? true : undefined}
            >
              <option value="">Seleccionar…</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.code} — {department.name}
                </option>
              ))}
            </select>
            <FieldIssue messages={issues.departmentId} />
          </label>
          <label className={`field ${issues.issueDate?.length ? "has-error" : ""}`}>
            <span>Fecha apertura *</span>
            <input
              name="issueDate"
              type="date"
              value={issueDateValue}
              onChange={(e) => setIssueDateValue(e.target.value)}
              required
              aria-invalid={issues.issueDate?.length ? true : undefined}
            />
            <FieldIssue messages={issues.issueDate} />
          </label>
          <Field label="Fecha/hora del evento" name="eventDateTime" type="datetime-local" defaultValue={formDefaults.eventDateTime} required issues={issues.eventDateTime} />
          <Field label="Detectado por" name="detectedBy" defaultValue={formDefaults.detectedBy} required issues={issues.detectedBy} />
          <Field label="Cumplimentado por" name="createdByText" defaultValue={formDefaults.createdByText} required issues={issues.createdByText} />
          <Field label="Breve descripción del proceso/equipo/sistema afectado" name="materialProcessAffected" defaultValue={formDefaults.materialProcessAffected} span="span-2" required issues={issues.materialProcessAffected} />
        </div>
      </section>

      <section className="form-section">
        <h2>A. Origen</h2>
        <p className="section-help">Selecciona, si corresponde, un único origen principal. Solo se muestran los campos asociados al origen elegido.</p>
        <div className="origin-selector" role="radiogroup" aria-label="Origen principal de la desviación">
          {deviationProvenanceOptions.map(({value, label}) => (
            <label key={value} className={`origin-option ${origin === value ? "selected" : ""}`}>
              <input
                type="radio"
                name="provenance"
                value={value}
                checked={origin === value}
                onChange={() => setOrigin(value as OriginType)}
              />
              <span>{label}</span>
            </label>
          ))}
          {origin ? (
            <button type="button" className="button small" onClick={() => setOrigin("")}>Quitar selección</button>
          ) : null}
        </div>

        {origin === "FINISHED_PRODUCT_SYSTEM" ? (
          <div className="deviation-origin-group">
            <h3>Producto terminado / Sistema</h3>
            <div className="form-grid">
              <Field label="Producto terminado / sistema" name="finishedProductSystem" defaultValue={formDefaults.finishedProductSystem} span="span-2" required issues={issues.finishedProductSystem} />
              <Field label="Nº de lote" name="productLot" defaultValue={formDefaults.productLot} required issues={issues.productLot} />
              <Field label="Tamaño de lote" name="lotSize" defaultValue={formDefaults.lotSize} required issues={issues.lotSize} />
              <Field label="Cantidad afectada" name="affectedQuantity" defaultValue={formDefaults.affectedQuantity} required issues={issues.affectedQuantity} />
            </div>
          </div>
        ) : null}

        {origin === "CLIENT" ? (
          <div className="deviation-origin-group">
            <h3>Cliente</h3>
            <div className="form-grid">
              <Field label="Cliente" name="client" defaultValue={formDefaults.client} span="span-2" required issues={issues.client} />
            </div>
          </div>
        ) : null}

        {origin === "RAW_PACKAGING_MATERIAL" ? (
          <div className="deviation-origin-group">
            <h3>Materia prima / Material de acondicionamiento</h3>
            <div className="form-grid">
              <Field label="Materia prima / material de acondicionamiento" name="rawOrPackagingMaterial" defaultValue={formDefaults.rawOrPackagingMaterial} span="span-2" required issues={issues.rawOrPackagingMaterial} />
              <Field label="Nº de lote" name="materialLot" defaultValue={formDefaults.materialLot} required issues={issues.materialLot} />
              <Field label="Tamaño de lote / cantidad (cuando proceda)" name="materialLotSize" defaultValue={formDefaults.materialLotSize} />
              <Field label="Cantidad afectada" name="materialAffectedQuantity" defaultValue={formDefaults.materialAffectedQuantity} required issues={issues.materialAffectedQuantity} />
            </div>
          </div>
        ) : null}

        {origin === "SUPPLIER" ? (
          <div className="deviation-origin-group">
            <h3>Proveedor</h3>
            <div className="form-grid">
              <Field label="Proveedor" name="supplier" defaultValue={formDefaults.supplier} span="span-2" required issues={issues.supplier} />
              <Field label="Lote de proveedor" name="supplierLot" defaultValue={formDefaults.supplierLot} required issues={issues.supplierLot} />
            </div>
          </div>
        ) : null}

        {origin === "EQUIPMENT_LINE" ? (
          <div className="deviation-origin-group">
            <h3>Equipo / Línea afectada</h3>
            <div className="form-grid">
              <Field label="Equipo o línea afectada" name="affectedEquipmentLine" defaultValue={formDefaults.affectedEquipmentLine} span="span-2" required issues={issues.affectedEquipmentLine} />
            </div>
          </div>
        ) : null}

        {origin === "OTHER" ? (
          <div className="deviation-origin-group">
            <h3>Otros</h3>
            <div className="form-grid">
              <Field label="Especificar" name="otherOrigin" defaultValue={formDefaults.otherOrigin} span="span-2" required issues={issues.otherOrigin} />
            </div>
          </div>
        ) : null}
      </section>

      <section className="form-section">
        <h2>B. Documentación afectada</h2>
        <p className="section-help">Documentos, procedimientos, instrucciones o registros afectados por la desviación.</p>
        <div className="form-grid">
          <TextArea label="Documentación afectada" name="affectedDocumentation" defaultValue={formDefaults.affectedDocumentation} required issues={issues.affectedDocumentation} />
        </div>
      </section>

      <section className="form-section">
        <h2>C. Descripción del evento</h2>
        <p className="section-help">Registrar hechos observables. No incluir aquí causas, impacto, hipótesis ni acciones futuras.</p>
        <div className="form-grid">
          <TextArea label="¿Qué sucedió / qué debía haber sucedido?" name="whatHappened" defaultValue={formDefaults.whatHappened} required issues={issues.whatHappened} />
          <TextArea label="¿Quién estuvo implicado y cuál fue su papel?" name="whoInvolved" defaultValue={formDefaults.whoInvolved} required issues={issues.whoInvolved} />
          <TextArea label="¿Cuándo ocurrió?" name="whenHappened" defaultValue={formDefaults.whenHappened} required issues={issues.whenHappened} />
          <TextArea label="¿Dónde ocurrió?" name="whereHappened" defaultValue={formDefaults.whereHappened} required issues={issues.whereHappened} />
          <TextArea label="¿Cómo se detectó / cómo ocurrió?" name="howHappened" defaultValue={formDefaults.howHappened} required issues={issues.howHappened} />
        </div>
      </section>

      <section className="form-section">
        <h2>D. Acción inmediata</h2>
        <p className="section-help">Solo actuaciones ya ejecutadas para contener, corregir o controlar el evento. No confundir con CAPA.</p>
        {issues.immediateActionsJson?.length ? <div className="field-error-block"><FieldIssue messages={issues.immediateActionsJson} /></div> : null}
        <div className="dynamic-list">
          {actions.map((item, index) => (
            <div className="dynamic-row" key={index}>
              <label className="field">
                <span>Acción ejecutada</span>
                <input value={item.description} onChange={(e) => updateAction(index, { description: e.target.value })} />
              </label>
              <label className="field">
                <span>Ejecutada por</span>
                <input value={item.executedBy} onChange={(e) => updateAction(index, { executedBy: e.target.value })} />
              </label>
              <label className="field">
                <span>Fecha</span>
                <input type="date" value={item.executedAt} onChange={(e) => updateAction(index, { executedAt: e.target.value })} />
              </label>
              <button type="button" className="button danger small" onClick={() => setActions((current) => current.filter((_, i) => i !== index))}>Quitar</button>
            </div>
          ))}
          <div><button type="button" className="button small" onClick={() => setActions((current) => [...current, { ...emptyAction }])}>+ Añadir acción inmediata</button></div>
        </div>
      </section>

      <section className="form-section">
        <h2>E. Investigación</h2>
        <p className="section-help">Documentar la investigación realizada y si las evidencias permiten alcanzar una conclusión.</p>
        <div className="form-grid">
          <TextArea label="Investigación realizada / resultado y conclusiones" name="investigation" defaultValue={formDefaults.investigation} required issues={issues.investigation} />
          <TriStateSelect label="¿Investigación concluyente?" name="investigationConclusive" defaultValue={formDefaults.investigationConclusive} required issues={issues.investigationConclusive} />
        </div>
      </section>

      <section className="form-section">
        <h2>F-G. Causa raíz</h2>
        <p className="section-help">Metodología de análisis, causa de fondo, recurrencia y antecedentes relacionados.</p>
        <div className="form-grid">
          <div className={`field full ${issues.investigationMethods?.length ? "has-error" : ""}`}>
            <span>Metodología empleada *</span>
            <div className="checkbox-group">
              {[
                ["BRAINSTORMING", "Brainstorming"],
                ["FIVE_WHYS", "5 porqués"],
                ["FTA", "FTA"],
                ["ISHIKAWA", "Ishikawa"],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    name="investigationMethods"
                    value={value}
                    defaultChecked={formDefaults.investigationMethods?.includes(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <FieldIssue messages={issues.investigationMethods} />
          </div>
          <TextArea label="Causa raíz" name="rootCause" defaultValue={formDefaults.rootCause} help="Registrar únicamente la causa de fondo sustentada por la investigación." required issues={issues.rootCause} />
          <TriStateSelect label="¿Causa raíz recurrente?" name="recurrentRootCause" defaultValue={formDefaults.recurrentRootCause} required issues={issues.recurrentRootCause} />
          <label className={`field span-3 ${issues.recurrenceDetails?.length ? "has-error" : ""}`}>
            <span>Antecedentes / detalle de recurrencia *</span>
            <textarea name="recurrenceDetails" defaultValue={formDefaults.recurrenceDetails ?? ""} required aria-invalid={issues.recurrenceDetails?.length ? true : undefined} />
            <FieldIssue messages={issues.recurrenceDetails} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>H. Clasificación de la desviación</h2>
        <p className="section-help">Clasificación GMP del evento según su criticidad.</p>
        <div className="form-grid">
          <label className={`field ${issues.classification?.length ? "has-error" : ""}`}>
            <span>Clasificación *</span>
            <select name="classification" defaultValue={formDefaults.classification ?? ""} required aria-invalid={issues.classification?.length ? true : undefined}>
              <option value="">No clasificada</option>
              <option value="CRITICAL">Crítica</option>
              <option value="MAJOR">Mayor</option>
              <option value="MINOR">Menor</option>
            </select>
            <FieldIssue messages={issues.classification} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>I. Impacto</h2>
        <p className="section-help">La evaluación de impacto debe apoyarse en la investigación y no introducir nuevas causas.</p>
        <div className="form-grid">
          <TriStateSelect label="Impacto validación" name="validationImpact" defaultValue={formDefaults.validationImpact} required issues={issues.validationImpact} />
          <TriStateSelect label="Impacto registro" name="registrationImpact" defaultValue={formDefaults.registrationImpact} required issues={issues.registrationImpact} />
          <TriStateSelect label="Impacto estabilidad" name="stabilityImpact" defaultValue={formDefaults.stabilityImpact} required issues={issues.stabilityImpact} />
          <TriStateSelect label="Otros procesos / productos" name="otherProcessesImpact" defaultValue={formDefaults.otherProcessesImpact} required issues={issues.otherProcessesImpact} />
          <TriStateSelect label="Afecta a producto terminado" name="affectsFinishedProduct" defaultValue={formDefaults.affectsFinishedProduct} required issues={issues.affectsFinishedProduct} />
          <label className={`field span-2 ${issues.otherProcessesImpactDetails?.length ? "has-error" : ""}`}>
            <span>Detalle / justificación de impacto *</span>
            <textarea name="otherProcessesImpactDetails" defaultValue={formDefaults.otherProcessesImpactDetails ?? ""} required aria-invalid={issues.otherProcessesImpactDetails?.length ? true : undefined} />
            <FieldIssue messages={issues.otherProcessesImpactDetails} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h2>J. CAPA</h2>
        <p className="section-help">Las CAPA deben derivar de la causa raíz. Se mantienen las propuestas y vínculos existentes sin cambiar su lógica en D1.</p>
        <div className="form-grid">
          <label className={`field ${issues.capaRequired?.length ? "has-error" : ""}`}>
            <span>¿Procede abrir CAPA? *</span>
            <select name="capaRequired" defaultValue={formDefaults.capaRequired ?? ""} required aria-invalid={issues.capaRequired?.length ? true : undefined}>
              <option value="">Pendiente</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
            <FieldIssue messages={issues.capaRequired} />
          </label>
        </div>
        {issues.capaPlansJson?.length ? <div className="field-error-block"><FieldIssue messages={issues.capaPlansJson} /></div> : null}
        <div className="dynamic-list" style={{ marginTop: 12 }}>
          {capas.map((item, index) => (
            <div className="dynamic-row capa" key={index}>
              <label className="field">
                <span>Tipo</span>
                <select value={item.actionType} onChange={(e) => updateCapa(index, { actionType: e.target.value as CapaPlanInput["actionType"] })}>
                  <option value="CORRECTIVE">Correctiva</option>
                  <option value="PREVENTIVE">Preventiva</option>
                </select>
              </label>
              <label className="field">
                <span>Acción CAPA propuesta</span>
                <input value={item.description} onChange={(e) => updateCapa(index, { description: e.target.value })} />
              </label>
              <label className="field">
                <span>Fecha prevista</span>
                <input type="date" value={item.plannedExecutionDate} onChange={(e) => updateCapa(index, { plannedExecutionDate: e.target.value })} />
              </label>
              <label className="field">
                <span>Responsable</span>
                <input value={item.responsible} onChange={(e) => updateCapa(index, { responsible: e.target.value })} />
              </label>
              <button type="button" className="button danger small" onClick={() => setCapas((current) => current.filter((_, i) => i !== index))}>Quitar</button>
            </div>
          ))}
          <div><button type="button" className="button small" onClick={() => setCapas((current) => [...current, { ...emptyCapa }])}>+ Añadir CAPA propuesta</button></div>
        </div>
      </section>

      <section className="form-section">
        <h2>K-L. Conclusión y cierre</h2>
        <p className="section-help">La conclusión sintetiza investigación, causa, impacto, CAPA y disposición. No debe introducir información nueva.</p>
        <div className="form-grid">
          <TextArea label="Conclusión / cierre" name="conclusion" defaultValue={formDefaults.conclusion} required issues={issues.conclusion} />
          <Field label="Disposición final" name="disposition" defaultValue={formDefaults.disposition} span="span-2" required issues={issues.disposition} />
          <Field label="Cantidad" name="dispositionQuantity" defaultValue={formDefaults.dispositionQuantity} required issues={issues.dispositionQuantity} />
          <TriStateSelect label="Notificación al cliente" name="clientNotification" defaultValue={formDefaults.clientNotification} required issues={issues.clientNotification} />
          <TextArea label="Comentarios de disposición" name="dispositionComments" defaultValue={formDefaults.dispositionComments} required issues={issues.dispositionComments} />
        </div>
      </section>

      <section className="form-section">
        <h2>Información final del expediente</h2>
        <p className="section-help">Estado administrativo y controles finales del expediente.</p>
        <div className="form-grid">
          <Field label="Fecha cierre" name="closedAt" type="date" defaultValue={formDefaults.closedAt} issues={issues.closedAt} />
          <label className={`field ${issues.status?.length ? "has-error" : ""}`}>
            <span>Estado *</span>
            <select
              name="status"
              value={recordStatus}
              onChange={(e) => setRecordStatus(e.target.value as "DRAFT" | "OPEN" | "CLOSED")}
              required
              aria-invalid={issues.status?.length ? true : undefined}
            >
              {(mode === "create" || formDefaults.status === "DRAFT") ? <option value="DRAFT">Borrador</option> : null}
              <option value="OPEN">Abierta</option>
              {mode !== "create" && formDefaults.status !== "DRAFT" ? <option value="CLOSED">Cerrada</option> : null}
            </select>
            <FieldIssue messages={issues.status} />
          </label>
          <label className={`field ${issues.dataQualityStatus?.length ? "has-error" : ""}`}>
            <span>Control de estado *</span>
            <select name="dataQualityStatus" defaultValue={formDefaults.dataQualityStatus ?? "REVIEW_REQUIRED"} required aria-invalid={issues.dataQualityStatus?.length ? true : undefined}>
              <option value="COMPLETE">Completo</option>
              <option value="INCOMPLETE">Incompleto</option>
              <option value="REVIEW_REQUIRED">Pendiente de revisar</option>
            </select>
            <FieldIssue messages={issues.dataQualityStatus} />
          </label>
          <div className="field">
            <span>Documento firmado</span>
            <input
              type="hidden"
              name="signedDocumentAvailable"
              value={formDefaults.signedDocumentAvailable ?? ""}
            />
            <small className="muted-note">
              El PDF firmado se carga y controla por versión desde la pestaña Versiones del expediente.
            </small>
          </div>
          <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations} />
        </div>
      </section>

      {mode === "edit" ? (
        <section className="form-section">
          <h2>Edición / nueva versión</h2>
          <p className="section-help">Campos propios de la modificación y del versionado. Se mantienen separados de los apartados A-L.</p>
          <div className="form-grid">
            <Field label="Modificado por" name="modifiedByText" defaultValue={formDefaults.modifiedByText ?? formDefaults.createdByText} />
            <TextArea
              label="Motivo del cambio / seguimiento"
              name="changeReason"
              defaultValue={formDefaults.changeReason}
              help={`Obligatorio al generar ${deviationVersionLabel(currentVersionSequence + 1)}. Quedará asociado a la versión.`}
              issues={issues.changeReason}
            />
          </div>
        </section>
      ) : null}

      {recordStatus === "DRAFT" ? (
        <div className="form-errors draft-notice">
          <strong>Borrador</strong>
          <span>Puedes guardar el expediente incompleto. Los campos obligatorios pendientes se indicarán cuando intentes abrir la desviación.</span>
        </div>
      ) : null}

      <div className="form-footer">
        <Link className="button" href={cancelHref ?? (deviationId ? `/deviations/${deviationId}` : "/deviations")}>Cancelar</Link>
        {mode === "create" ? (
          <div className="version-submit-group">
            <button type="submit" name="saveIntent" value="draft" className="button" formNoValidate onClick={() => setOpeningAttempted(false)} disabled={pending}>
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
            <button type="submit" name="saveIntent" value="open" className="button primary" onClick={() => setOpeningAttempted(true)} disabled={pending}>
              {pending ? "Guardando…" : "Abrir desviación"}
            </button>
          </div>
        ) : formDefaults.status === "DRAFT" ? (
          <div className="version-submit-group">
            <button type="submit" name="saveIntent" value="draft" className="button" formNoValidate onClick={() => setOpeningAttempted(false)} disabled={pending}>
              {pending ? "Guardando…" : "Guardar borrador"}
            </button>
            <button type="submit" name="saveIntent" value="open" className="button primary" onClick={() => setOpeningAttempted(true)} disabled={pending}>
              {pending ? "Guardando…" : "Abrir desviación"}
            </button>
          </div>
        ) : (
          <div className="version-submit-group">
            <div className="version-submit-note">
              <strong>Versión vigente {deviationVersionLabel(currentVersionSequence)}</strong>
              <span>Guardar cambios mantiene esta versión. Generar una nueva versión congela la vigente.</span>
            </div>
            <button
              type="submit"
              name="saveMode"
              value="update-current"
              className="button"
              disabled={pending}
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="submit"
              name="saveMode"
              value="new-version"
              className="button primary"
              disabled={pending}
            >
              {pending ? "Guardando…" : `Generar nueva versión / seguimiento ${deviationVersionLabel(currentVersionSequence + 1)}`}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
