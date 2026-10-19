"use client";
import { ActorField } from "@/components/permissions";

import { CsrfField } from "@/components/csrf";

import { useActionState } from "react";
import { submittedDefaults } from "@/lib/forms/preserved-state";
import type { ProgrammeActionState } from "./actions";
import { issueAnnualProgrammeAction, saveProgrammeApproversAction } from "./actions";
function Result({ state }: { state: ProgrammeActionState }) {
  return state.error ? <p role="alert">{state.error}</p> : state.success ? <p role="status">{state.success}</p> : null;
}
export function ProgrammeApproversForm({ planId, internal, technical, quality }: { planId: string; internal: boolean; technical: string; quality: string }) {
  const [state, action, pending] = useActionState<ProgrammeActionState, FormData>(saveProgrammeApproversAction.bind(null, planId), {});
  const values = submittedDefaults<Record<string, string | string[]>>({ technicalApproverName: technical, qualityApproverName: quality, reason: "" }, state.submittedValues);
  return <form key={state.formRevision ?? 0} action={action} className="audit-child-form"><CsrfField />
    {internal ? <label className="field"><span>Nombre · Dirección Técnica</span><input name="technicalApproverName" defaultValue={String(values.technicalApproverName ?? "")} maxLength={250}/></label> : <input type="hidden" name="technicalApproverName" value=""/>}
    <label className="field"><span>Nombre · Dirección Garantía de Calidad</span><input name="qualityApproverName" defaultValue={String(values.qualityApproverName ?? "")} maxLength={250}/></label>
    <label className="field"><span>Responsable de los datos</span><ActorField name="actor" required maxLength={200}/></label>
    <label className="field full"><span>Motivo de actualización de aprobadores</span><input name="reason" defaultValue={String(values.reason ?? "")} required maxLength={20000}/></label>
    <div className="full"><Result state={state}/><button className="button" disabled={pending}>Guardar datos de aprobación</button></div>
  </form>;
}
export function ProgrammeIssueForm({ planId, fingerprint, requestId, blocked, subsequent }: { planId: string; fingerprint: string; requestId: string; blocked: boolean; subsequent: boolean }) {
  const [state, action, pending] = useActionState<ProgrammeActionState, FormData>(issueAnnualProgrammeAction.bind(null, planId), {});
  const values = submittedDefaults<Record<string, string | string[]>>({ reason: "" }, state.submittedValues);
  return <form key={state.formRevision ?? 0} action={action} className="audit-child-form"><CsrfField />
    <input type="hidden" name="expectedFingerprint" value={fingerprint}/><input type="hidden" name="requestId" value={requestId}/>
    <label className="field"><span>Responsable de emisión</span><ActorField name="actor" required maxLength={200}/></label>
    <label className="field full"><span>Motivo de emisión{subsequent ? " (obligatorio)" : " (opcional en la inicial)"}</span><textarea name="reason" defaultValue={String(values.reason ?? "")} required={subsequent} maxLength={20000}/></label>
    <div className="full"><Result state={state}/><button className="button primary" disabled={blocked || pending}>Emitir Programa Anual en Word</button></div>
  </form>;
}
