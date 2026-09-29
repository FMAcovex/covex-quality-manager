"use client";

import { useActionState } from "react";
import type { FollowupActionState } from "@/components/basic-followup-form";
import type { CapaFollowupDefaults } from "@/modules/capa/types";

type Action = (state: FollowupActionState, formData: FormData) => Promise<FollowupActionState>;

export function CapaFollowupForm({
  action,
  defaultActor = "",
  defaults,
}: {
  action: Action;
  defaultActor?: string;
  defaults: CapaFollowupDefaults;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="inline-form followup-form">
      {state.error ? <div className="form-feedback error">{state.error}</div> : null}
      {state.success ? <div className="form-feedback success">{state.success}</div> : null}

      <label className="field">
        <span>Fecha *</span>
        <input type="date" name="followupDate" required />
      </label>
      <label className="field">
        <span>Cumplimentado por *</span>
        <input name="completedByText" defaultValue={defaultActor} required />
      </label>
      <label className="field">
        <span>Motivo</span>
        <input name="reason" />
      </label>
      <label className="field full">
        <span>Actuación realizada / resultado *</span>
        <textarea name="description" required />
      </label>
      <label className="field">
        <span>Próxima fecha</span>
        <input type="date" name="nextFollowupDate" />
      </label>
      <label className="field">
        <span>Evidencia / referencia de ejecución</span>
        <input name="evidenceReference" />
      </label>
      <label className="field full">
        <span>Observaciones</span>
        <textarea name="observations" />
      </label>

      <div className="field full">
        <strong>Estado tras este seguimiento</strong>
        <small className="muted-note">
          Estos datos formarán parte de la nueva versión funcional de la CAPA.
        </small>
      </div>
      <label className="field">
        <span>Estado CAPA</span>
        <select name="status" defaultValue={defaults.status}>
          <option value="OPEN">Abierta</option>
          <option value="CLOSED">Cerrada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </label>
      <label className="field">
        <span>Fecha cierre operativo</span>
        <input
          type="date"
          name="operationalClosedAt"
          defaultValue={defaults.operationalClosedAt ?? ""}
        />
      </label>
      <label className="field full">
        <span>Motivo de cancelación</span>
        <textarea
          name="cancellationReason"
          defaultValue={defaults.cancellationReason ?? ""}
        />
      </label>
      <label className="field full">
        <span>Conclusión / cierre operativo</span>
        <textarea name="conclusion" defaultValue={defaults.conclusion ?? ""} />
      </label>

      <label className="field">
        <span>Verificación de eficacia</span>
        <select name="effectivenessStatus" defaultValue={defaults.effectivenessStatus}>
          <option value="PENDING">Pendiente</option>
          <option value="CONFORMING">Conforme</option>
          <option value="NONCONFORMING">No conforme</option>
          <option value="NA" disabled={defaults.effectivenessStatus !== "NA"}>
            N/A (solo histórico)
          </option>
        </select>
      </label>
      <label className="field">
        <span>Fecha cierre efectivo</span>
        <input
          type="date"
          name="effectiveClosedAt"
          defaultValue={defaults.effectiveClosedAt ?? ""}
        />
      </label>
      <label className="field full">
        <span>Criterio de eficacia</span>
        <textarea
          name="effectivenessCriteria"
          defaultValue={defaults.effectivenessCriteria ?? ""}
        />
      </label>
      <label className="field full">
        <span>Valoración de la eficacia</span>
        <textarea
          name="effectivenessAssessment"
          defaultValue={defaults.effectivenessAssessment ?? ""}
        />
      </label>
      <label className="field full">
        <span>Evidencia de eficacia</span>
        <textarea
          name="effectivenessEvidence"
          defaultValue={defaults.effectivenessEvidence ?? ""}
        />
      </label>

      <div className="field form-submit">
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar seguimiento"}
        </button>
      </div>
    </form>
  );
}
