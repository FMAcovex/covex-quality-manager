"use client";

import { AdditionalLotsField } from "@/components/additional-lots-field";
import { RootCauseCategoryField } from "@/components/root-cause-category-field";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { CsrfField } from "@/components/csrf";
import { ControlledBusinessCodeField } from "@/components/controlled-business-code-field";
import { PermissionGate, usePresentationAccess } from "@/components/permissions";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { InvalidFieldsSummary } from "@/components/invalid-fields-summary";
import { generalErrors } from "@/lib/forms/field-issues";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import {
  oosAreaLabels,
  oosClosingResults,
  oosInvestigationResultLabels,
  oosMaterialKindLabels,
  oosPhaseIDispositionLabels,
  oosPhaseIEvaluationGroups,
  oosVerdictLabels,
} from "../domain";
import type { OosDepartmentOption, OosFormDefaults, OosFormState } from "../types";

const initial: OosFormState = { error: null };
type Status = "DRAFT" | "OPEN" | "CLOSED";
type Disposition = "LAB_ERROR" | "FULL_SCALE";

function Field({ label, name, defaultValue, type = "text", required = false, span = "" }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean; span?: string }) {
  return <label className={`field ${span}`}><span>{label}{required ? " *" : ""}</span><input name={name} type={type} defaultValue={defaultValue ?? ""} required={required} /></label>;
}

function TextArea({ label, name, defaultValue, required = false, help }: { label: string; name: string; defaultValue?: string; required?: boolean; help?: string }) {
  return <label className="field full"><span>{label}{required ? " *" : ""}</span><textarea name={name} defaultValue={defaultValue ?? ""} required={required} />{help ? <small className="muted-note">{help}</small> : null}</label>;
}

function Verdict({ phase, defaults, required }: { phase: "phaseI" | "phaseII"; defaults: OosFormDefaults; required: boolean }) {
  const [verdict, setVerdict] = useState<string>(defaults[`${phase}Verdict`] ?? "");
  return <>
    <label className="field"><span>Dictamen{required ? " *" : ""}</span><select name={`${phase}Verdict`} value={verdict} onChange={(event) => setVerdict(event.target.value)} required={required}><option value="">Pendiente</option>{Object.entries(oosVerdictLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <Field label="Cantidad" name={`${phase}VerdictQuantity`} defaultValue={defaults[`${phase}VerdictQuantity`]} />
    <Field label="Destruir · cantidad" name={`${phase}DestroyQuantity`} defaultValue={defaults[`${phase}DestroyQuantity`]} />
    <Field label="Devolver · cantidad" name={`${phase}ReturnQuantity`} defaultValue={defaults[`${phase}ReturnQuantity`]} />
    <Field label="Otros · indicar" name={`${phase}VerdictOther`} defaultValue={defaults[`${phase}VerdictOther`]} required={verdict === "OTHER"} span="span-2" />
  </>;
}

export function OosForm({ mode, action, departments, defaults = {}, recordId, cancelHref, returnTo, detailTab }: {
  mode: "create" | "edit";
  action: (state: OosFormState, formData: FormData) => Promise<OosFormState>;
  departments: OosDepartmentOption[];
  defaults?: OosFormDefaults;
  recordId?: string;
  cancelHref?: string;
  returnTo?: string;
  detailTab?: string;
}) {
  const access = usePresentationAccess();
  const [state, formAction, pending] = useActionState(action, initial);
  const formDefaults = submittedDefaults(defaults, state.submittedValues);
  const codeLocked = mode === "edit" && Boolean(defaults.businessCode);
  const [status, setStatus] = useState<Status>(formDefaults.status ?? "DRAFT");
  const [area, setArea] = useState<string>(formDefaults.area ?? "");
  const [departmentId, setDepartmentId] = useState(formDefaults.departmentId ?? "");
  const [issueDate, setIssueDate] = useState(formDefaults.issueDate ?? "");
  const [materialKind, setMaterialKind] = useState<string>(formDefaults.materialKind ?? "");
  const [disposition, setDisposition] = useState<string>(formDefaults.phaseIDisposition ?? "");
  useEffect(() => {
    if (state.savedRecordId) window.location.assign(mode === "edit" && cancelHref ? cancelHref : `/oos/${state.savedRecordId}`);
  }, [state.savedRecordId, mode, cancelHref]);

  const draft = status === "DRAFT";
  const closed = status === "CLOSED";
  const phaseII = disposition === "FULL_SCALE";
  const results = oosClosingResults((disposition || null) as Disposition | null);

  return <form key={state.formRevision ?? 0} action={formAction} className="form-stack"><CsrfField />
    <UnsavedChangesGuard pending={pending} saveError={Boolean(state.error)} />
    <InvalidFieldsSummary serverIssues={state.fieldIssues} />
    <input type="hidden" name="returnTo" value={returnTo ?? ""} />
    <input type="hidden" name="detailTab" value={detailTab ?? ""} />
    {state.error ? <div className="form-errors"><strong>{state.error}</strong>{generalErrors(state.fieldErrors, state.fieldIssues).length ? <ul>{generalErrors(state.fieldErrors, state.fieldIssues).map((error) => <li key={error}>{error}</li>)}</ul> : null}</div> : null}

    <section className="form-section">
      <h2>1. Identificación</h2>
      <p className="section-help">{draft ? "En borrador puedes dejar datos pendientes. Al abrir el OOS se asigna el código y se validan los datos iniciales." : "Los campos marcados con * son obligatorios."}</p>
      <div className="form-grid return-form-grid">
        <ControlledBusinessCodeField recordType="OOS" label="N.º informe OOS" initialValue={formDefaults.businessCode} mode={mode} yearSource={issueDate} oosArea={(area || null) as "API" | "MD" | null} locked={codeLocked || (mode === "edit" && !draft)} />
        {codeLocked ? <input type="hidden" name="area" value={area} /> : null}
        <label className="field"><span>Área{draft ? "" : " *"}</span><select name="area" value={area} onChange={(event) => setArea(event.target.value)} disabled={codeLocked} required={!draft}><option value="">Seleccionar…</option>{Object.entries(oosAreaLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small className="muted-note">API y MD tienen numeración independiente (GC-10/014/04 §5.1).</small></label>
        <label className="field"><span>Departamento{draft ? "" : " *"}</span><select name="departmentId" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required={!draft}><option value="">Seleccionar…</option>{departments.filter((department) => access?.departments[department.id] || department.id === departmentId).map((department) => <option key={department.id} value={department.id}>{department.code} — {department.name}</option>)}</select></label>
        <label className="field"><span>Fecha de emisión{draft ? "" : " *"}</span><input name="issueDate" type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required={!draft} /></label>
        <Field label="Cumplimentado por" name="createdByText" defaultValue={formDefaults.createdByText} />
        {mode === "edit" ? <Field label="Modificado por" name="modifiedByText" defaultValue={access?.actor ?? ""} /> : null}
      </div>
    </section>

    <section className="form-section">
      <h2>2. Datos iniciales</h2>
      <p className="section-help">Anexo III, Fase I: material afectado y detección del fuera de especificación.</p>
      <div className="form-grid return-form-grid">
        <label className="field span-2"><span>Material afectado{draft ? "" : " *"}</span><select name="materialKind" value={materialKind} onChange={(event) => setMaterialKind(event.target.value)} required={!draft}><option value="">Seleccionar…</option>{Object.entries(oosMaterialKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <Field label={materialKind === "RAW_OR_PACKAGING_MATERIAL" ? "Materia prima / mat. acondicionamiento" : "Producto final (API / medicamento)"} name="materialName" defaultValue={formDefaults.materialName} required={!draft} span="span-2" />
        <Field label="N.º lote" name="lotNumber" defaultValue={formDefaults.lotNumber} required={!draft} />
        <Field label="Tamaño lote" name="batchSize" defaultValue={formDefaults.batchSize} />
        <Field label="Cantidad afectada" name="affectedQuantity" defaultValue={formDefaults.affectedQuantity} />
        <AdditionalLotsField defaultValue={formDefaults.additionalLots} labels={{ name: "Material", lot: "N.º lote", size: "Tamaño lote", quantity: "Cantidad afectada" }} />
        <Field label="Proceso" name="process" defaultValue={formDefaults.process} />
        {materialKind === "RAW_OR_PACKAGING_MATERIAL" ? <>
          <Field label="Proveedor" name="supplier" defaultValue={formDefaults.supplier} />
          <Field label="Lote proveedor" name="supplierLot" defaultValue={formDefaults.supplierLot} />
        </> : null}
        <Field label="Fecha del OOS" name="oosDate" type="date" defaultValue={formDefaults.oosDate} />
        <Field label="Hora del OOS" name="oosTime" type="time" defaultValue={formDefaults.oosTime} />
        <Field label="OOS detectado por (analista)" name="detectedBy" defaultValue={formDefaults.detectedBy} />
        <Field label="Turno" name="shift" defaultValue={formDefaults.shift} />
        <TextArea label="Detección del fuera de especificaciones" name="detectionDescription" defaultValue={formDefaults.detectionDescription} required={!draft} help="Descripción del OOS: ¿qué, quién, cómo, dónde, cuándo y por qué?" />
      </div>
    </section>

    <section className="form-section">
      <h2>3. Fase I · Evaluación del fuera de especificación</h2>
      <p className="section-help">Anexo III: resultado de cada parámetro. El bloque de microbiología solo aplica a análisis microbiológicos.</p>
      {oosPhaseIEvaluationGroups.map((group) => <div key={group.key}>
        <h3>{group.label}</h3>
        <div className="form-grid return-form-grid">
          {group.items.map((item) => <label key={item.key} className="field span-2"><span>{item.label}</span><input name={`evaluation.${item.key}`} defaultValue={formDefaults[`evaluation.${item.key}`] ?? ""} placeholder="Resultado" /></label>)}
        </div>
      </div>)}
    </section>

    <section className="form-section">
      <h2>4. Fase I · Investigación en el laboratorio</h2>
      <div className="form-grid return-form-grid">
        <TextArea label="Investigación (establecer causa raíz)" name="phaseIInvestigation" defaultValue={formDefaults.phaseIInvestigation} />
        <TextArea label="Conclusiones del fuera de especificación" name="phaseIConclusion" defaultValue={formDefaults.phaseIConclusion} required={closed && disposition === "LAB_ERROR"} help="Indicar si la investigación ha sido concluyente y se confirma error de laboratorio." />
        <label id="phase-i-disposition" className="field span-2"><span>Disposición final{closed ? " *" : ""}</span><select name="phaseIDisposition" value={disposition} onChange={(event) => setDisposition(event.target.value)} required={closed}><option value="">Pendiente</option>{Object.entries(oosPhaseIDispositionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small className="muted-note">«A gran escala» habilita la Fase II (Anexo IV).</small></label>
        <Verdict phase="phaseI" defaults={formDefaults} required={closed && disposition === "LAB_ERROR"} />
        <Field label="Emitido por · Control de Calidad" name="phaseIIssuedBy" defaultValue={formDefaults.phaseIIssuedBy} required={closed && disposition === "LAB_ERROR"} />
        <Field label="Fecha emisión" name="phaseIIssuedAt" type="date" defaultValue={formDefaults.phaseIIssuedAt} required={closed && disposition === "LAB_ERROR"} />
        <Field label="Aprobado por · Garantía de Calidad" name="phaseIApprovedBy" defaultValue={formDefaults.phaseIApprovedBy} />
        <Field label="Fecha aprobación" name="phaseIApprovedAt" type="date" defaultValue={formDefaults.phaseIApprovedAt} />
      </div>
    </section>

    <section className="form-section" hidden={!phaseII}>
      <h2>5. Fase II · Investigación a gran escala</h2>
      <p className="section-help">Anexo IV. La realiza y coordina Garantía de Calidad con los departamentos implicados.</p>
      <div className="form-grid return-form-grid">
        <Field label="Fecha emisión" name="phaseIIIssueDate" type="date" defaultValue={formDefaults.phaseIIIssueDate} />
        <TextArea label="Revisión de la producción" name="phaseIIProductionReview" defaultValue={formDefaults.phaseIIProductionReview} help="1. Motivo de la investigación. 2. Aspectos del proceso que pueden haber causado el problema. 3. Revisión de la documentación con causa real o probable. 4. Si el problema ha ocurrido anteriormente. 5. Acciones correctivas tomadas." />
        <TextArea label="Repetición de pruebas" name="phaseIIRetesting" defaultValue={formDefaults.phaseIIRetesting} help="Pruebas adicionales a realizar y manejo científico o técnico de los datos." />
        <TextArea label="Remuestreo" name="phaseIIResampling" defaultValue={formDefaults.phaseIIResampling} help="Plan de muestreo y análisis adicionales." />
        <TextArea label="Conclusión de la investigación" name="phaseIIConclusion" defaultValue={formDefaults.phaseIIConclusion} required={closed && phaseII} />
        {phaseII ? <Verdict phase="phaseII" defaults={formDefaults} required={closed} /> : null}
        <Field label="Emitido por · Garantía de Calidad" name="phaseIIIssuedBy" defaultValue={formDefaults.phaseIIIssuedBy} required={closed && phaseII} />
        <Field label="Fecha emisión del informe" name="phaseIIIssuedAt" type="date" defaultValue={formDefaults.phaseIIIssuedAt} required={closed && phaseII} />
        <TextArea label="Departamentos afectados" name="phaseIIAffectedDepartments" defaultValue={formDefaults.phaseIIAffectedDepartments} help="Todos los departamentos afectados, con quién firma y la fecha." />
      </div>
    </section>

    <section className="form-section">
      <h2>{phaseII ? "6" : "5"}. Resultado y estado</h2>
      <div className="form-grid return-form-grid">
        <label className="field"><span>Resultado de la investigación{closed ? " *" : ""}</span><select name="investigationResult" defaultValue={formDefaults.investigationResult ?? ""} required={closed} key={disposition}><option value="">Pendiente</option>{results.map((value) => <option key={value} value={value}>{oosInvestigationResultLabels[value]}</option>)}</select><small className="muted-note">{disposition ? "Según la disposición de la Fase I." : "Elige antes la disposición de la Fase I."}</small></label>
        <Field label="Fecha de cierre" name="closedAt" type="date" defaultValue={formDefaults.closedAt} required={closed} />
        <RootCauseCategoryField defaultValue={formDefaults.rootCauseCategories} />
        <label className="field"><span>Estado</span><select name="status" value={status} onChange={(event) => setStatus(event.target.value as Status)}>{mode === "create" || defaults.status === "DRAFT" ? <option value="DRAFT">Borrador</option> : null}<option value="OPEN">Abierto</option><PermissionGate permission="CLOSE"><option value="CLOSED">Cerrado</option></PermissionGate></select></label>
      </div>
    </section>

    <section className="form-section">
      <h2>Control interno</h2>
      <div className="form-grid return-form-grid">
        <TextArea label="Observaciones internas" name="internalObservations" defaultValue={formDefaults.internalObservations} />
        {mode === "edit" ? <TextArea label="Motivo del cambio" name="changeReason" /> : null}
      </div>
    </section>

    <div className="form-footer"><Link className="button" href={cancelHref ?? (recordId ? `/oos/${recordId}` : "/oos")}>Cancelar</Link><button className="button primary" disabled={pending}>{pending ? "Guardando…" : draft ? "Guardar borrador" : mode === "create" ? "Guardar OOS" : "Guardar cambios"}</button></div>
  </form>;
}
