"use client";
import { CsrfField } from "@/components/csrf";

import { useActionState } from "react";
import { issueAnnualProgrammeAction, saveProgrammeApproversAction } from "./actions";
function Result({ state }: { state: { error?: string; success?: string } }) {
  return state.error ? <p role="alert">{state.error}</p> : state.success ? <p role="status">{state.success}</p> : null;
}
export function ProgrammeApproversForm({ planId, internal, technical, quality }: { planId: string; internal: boolean; technical: string; quality: string }) {
  const [state, action, pending] = useActionState(saveProgrammeApproversAction.bind(null, planId), {});
  return <form action={action} className="audit-child-form"><CsrfField />
    {internal ? <label className="field"><span>Nombre · Dirección Técnica</span><input name="technicalApproverName" defaultValue={technical} maxLength={250}/></label> : <input type="hidden" name="technicalApproverName" value=""/>}
    <label className="field"><span>Nombre · Dirección Garantía de Calidad</span><input name="qualityApproverName" defaultValue={quality} maxLength={250}/></label>
    <label className="field"><span>Responsable de los datos</span><input name="actor" required maxLength={200}/></label>
    <label className="field full"><span>Motivo de actualización de aprobadores</span><input name="reason" required maxLength={20000}/></label>
    <div className="full"><Result state={state}/><button className="button" disabled={pending}>Guardar datos de aprobación</button></div>
  </form>;
}
export function ProgrammeIssueForm({ planId, fingerprint, requestId, blocked, subsequent }: { planId: string; fingerprint: string; requestId: string; blocked: boolean; subsequent: boolean }) {
  const [state, action, pending] = useActionState(issueAnnualProgrammeAction.bind(null, planId), {});
  return <form action={action} className="audit-child-form"><CsrfField />
    <input type="hidden" name="expectedFingerprint" value={fingerprint}/><input type="hidden" name="requestId" value={requestId}/>
    <label className="field"><span>Responsable de emisión</span><input name="actor" required maxLength={200}/></label>
    <label className="field full"><span>Motivo de emisión{subsequent ? " (obligatorio)" : " (opcional en la inicial)"}</span><textarea name="reason" required={subsequent} maxLength={20000}/></label>
    <div className="full"><Result state={state}/><button className="button primary" disabled={blocked || pending}>Emitir Programa Anual en Word</button></div>
  </form>;
}
