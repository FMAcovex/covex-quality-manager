"use client";
import { ActorField } from "@/components/permissions";
import { CsrfField } from "@/components/csrf";
import { ResponsibleUserSelect } from "@/components/responsible-user-select";
import type { AppUserOption } from "@/lib/qms/responsible-user";
import { useActionState, useEffect } from "react";
import { assignmentsAction, type SaveState } from "../actions";
import { revisionFunctions } from "../assignment-functions";
import { revisionLabels } from "../domain";
import type { ControlledDocumentRevisionStatus } from "@prisma/client";

type Assignee = { text: string | null; userId: string | null };
export type AssignableRevision = {
  id: string; code: string; status: ControlledDocumentRevisionStatus; updatedAt: string;
  preparation: Assignee & { date: string | null }; review: Assignee & { date: string | null }; approval: Assignee & { date: string | null };
};

/** D-118: responsables de las funciones de las revisiones en curso y de la revisión periódica. */
export function AssignmentsForm({ documentId, updatedAt, periodic, revisions, users, returnTo }: {
  documentId: string; updatedAt: string; periodic: Assignee; revisions: AssignableRevision[]; users: AppUserOption[]; returnTo?: string;
}) {
  const [state, submit, pending] = useActionState<SaveState, FormData>(assignmentsAction.bind(null, documentId), {});
  useEffect(() => { if (state.url) window.location.assign(state.url); }, [state.url]);
  const value = (name: string, fallback: string | null) => {
    const submitted = state.submittedValues?.[name];
    return typeof submitted === "string" ? submitted : fallback ?? "";
  };
  return <form key={state.formRevision ?? 0} action={submit} className="form-stack"><CsrfField />
    <input type="hidden" name="returnTo" value={returnTo || ""}/>
    <input type="hidden" name="updatedAt" value={updatedAt}/>
    {state.error && <div className="form-errors" role="alert">{state.error}</div>}
    <fieldset className="form-section"><legend>Revisión periódica</legend>
      <p className="section-help">Persona que vigila la próxima revisión de la versión vigente. Cuando venza o falten 30 días, le aparece en Mis tareas, salvo que ya haya una revisión nueva en curso.</p>
      <div className="form-grid">
        <label className="field"><span>Responsable de la revisión periódica</span><input name="periodicReviewResponsible" maxLength={200} defaultValue={value("periodicReviewResponsible", periodic.text)}/></label>
        <ResponsibleUserSelect users={users} name="periodicReviewResponsibleUserId" textName="periodicReviewResponsible" defaultValue={value("periodicReviewResponsibleUserId", periodic.userId)}/>
      </div>
    </fieldset>
    {revisions.length ? revisions.map(r => <fieldset className="form-section" key={r.id}><legend>Revisión {r.code} · {revisionLabels[r.status]}</legend>
      <input type="hidden" name="revisionId" value={r.id}/>
      <input type="hidden" name={`${r.id}.updatedAt`} value={r.updatedAt}/>
      <p className="section-help">A cada persona le aparece su tarea en Mis tareas solo mientras la revisión está en su fase: Elabora en Borrador, Revisa en En revisión y Aprueba en Pendiente de aprobación. No sustituye al registro de las funciones externas ni a la firma.</p>
      <div className="form-stack">{revisionFunctions.map(f => <div className="form-grid" key={f.key}>
        <label className="field"><span>{f.label}</span><input name={`${r.id}.${f.key}Responsible`} maxLength={200} defaultValue={value(`${r.id}.${f.key}Responsible`, r[f.key].text)}/></label>
        <ResponsibleUserSelect users={users} name={`${r.id}.${f.key}ResponsibleUserId`} textName={`${r.id}.${f.key}Responsible`} defaultValue={value(`${r.id}.${f.key}ResponsibleUserId`, r[f.key].userId)}/>
        <label className="field"><span>Fecha prevista</span><input type="date" name={`${r.id}.${f.key}TargetDate`} defaultValue={value(`${r.id}.${f.key}TargetDate`, r[f.key].date)}/></label>
      </div>)}</div>
    </fieldset>) : <p className="muted-note">No hay revisiones en elaboración, revisión ni aprobación. Para asignar las funciones, añade antes una revisión nueva.</p>}
    <fieldset className="form-section"><legend>Registro</legend>
      <label className="field"><span>Responsable del registro</span><ActorField name="actor" required/></label>
    </fieldset>
    <div className="form-actions"><button className="button primary" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar responsables"}</button></div>
  </form>;
}
