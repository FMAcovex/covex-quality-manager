"use client";
import { CsrfField } from "@/components/csrf";


import { useActionState, useState } from "react";
import type { FollowupActionState } from "@/components/basic-followup-form";
import type { CapaFollowupDefaults } from "@/modules/capa/types";

type Action = (state: FollowupActionState, formData: FormData) => Promise<FollowupActionState>;

function versionLabel(sequenceNumber: number) {
  return `V${String(sequenceNumber).padStart(2, "0")}`;
}

export function CapaFollowupForm({
  action,
  defaultActor = "",
  defaults,
  nextSequenceNumber,
}: {
  action: Action;
  defaultActor?: string;
  defaults: CapaFollowupDefaults;
  nextSequenceNumber: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [status, setStatus] = useState(defaults.status);
  const [effectivenessStatus, setEffectivenessStatus] = useState(
    defaults.effectivenessStatus,
  );

  return (
    <form action={formAction} className="inline-form followup-form"><CsrfField />
      {state.error ? <div className="form-feedback error">{state.error}</div> : null}
      {state.success ? <div className="form-feedback success">{state.success}</div> : null}

      <div className="field full">
        <strong>Seguimiento {String(nextSequenceNumber).padStart(2, "0")} · {versionLabel(nextSequenceNumber)}</strong>
        <small className="muted-note">
          Al guardar se congelará la versión anterior y este estado pasará a ser la nueva versión vigente.
        </small>
      </div>

      <div className="field full">
        <strong>1. Seguimiento y evidencia</strong>
      </div>
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
        <span>Evidencia / referencia de ejecución</span>
        <input name="evidenceReference" />
      </label>
      <label className="field full">
        <span>Observaciones</span>
        <textarea name="observations" />
      </label>

      <div className="field full">
        <strong>2. Estado y cierre operativo</strong>
        <small className="muted-note">
          El estado seleccionado quedará registrado en {versionLabel(nextSequenceNumber)}.
        </small>
      </div>
      <label className="field">
        <span>Estado CAPA</span>
        <select
          name="status"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as CapaFollowupDefaults["status"])
          }
        >
          <option value="OPEN">Abierta</option>
          <option value="CLOSED">Cerrada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </label>
      <label className="field">
        <span>Próxima fecha de seguimiento</span>
        <input type="date" name="nextFollowupDate" />
        <small className="muted-note">
          Obligatoria si la CAPA permanece abierta; útil para una verificación de eficacia posterior.
        </small>
      </label>

      {status === "CLOSED" ? (
        <>
          <label className="field">
            <span>Fecha cierre operativo *</span>
            <input
              type="date"
              name="operationalClosedAt"
              defaultValue={defaults.operationalClosedAt ?? ""}
            />
          </label>
          <label className="field full">
            <span>Conclusión / cierre operativo *</span>
            <textarea name="conclusion" defaultValue={defaults.conclusion ?? ""} />
          </label>
        </>
      ) : (
        <>
          <input
            type="hidden"
            name="operationalClosedAt"
            value={defaults.operationalClosedAt ?? ""}
          />
          <input type="hidden" name="conclusion" value={defaults.conclusion ?? ""} />
        </>
      )}

      {status === "CANCELLED" ? (
        <label className="field full">
          <span>Motivo de cancelación *</span>
          <textarea
            name="cancellationReason"
            defaultValue={defaults.cancellationReason ?? ""}
          />
        </label>
      ) : (
        <input
          type="hidden"
          name="cancellationReason"
          value={defaults.cancellationReason ?? ""}
        />
      )}

      <div className="field full">
        <strong>3. Verificación de eficacia</strong>
        <small className="muted-note">
          La ejecución/cierre operativo y la eficacia se mantienen separados.
        </small>
      </div>
      <label className="field">
        <span>Estado de eficacia</span>
        <select
          name="effectivenessStatus"
          value={effectivenessStatus}
          onChange={(event) =>
            setEffectivenessStatus(
              event.target.value as CapaFollowupDefaults["effectivenessStatus"],
            )
          }
        >
          <option value="PENDING">Pendiente</option>
          <option value="CONFORMING">Conforme</option>
          <option value="NONCONFORMING">No conforme</option>
          <option value="NA" disabled={defaults.effectivenessStatus !== "NA"}>
            N/A (solo histórico)
          </option>
        </select>
      </label>
      <label className="field full">
        <span>Criterio de eficacia</span>
        <textarea
          name="effectivenessCriteria"
          defaultValue={defaults.effectivenessCriteria ?? ""}
        />
      </label>

      {effectivenessStatus !== "PENDING" ? (
        <>
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
        </>
      ) : (
        <>
          <input
            type="hidden"
            name="effectivenessAssessment"
            value={defaults.effectivenessAssessment ?? ""}
          />
          <input
            type="hidden"
            name="effectivenessEvidence"
            value={defaults.effectivenessEvidence ?? ""}
          />
        </>
      )}

      {effectivenessStatus === "CONFORMING" ? (
        <label className="field">
          <span>Fecha cierre efectivo</span>
          <input
            type="date"
            name="effectiveClosedAt"
            defaultValue={defaults.effectiveClosedAt ?? ""}
          />
        </label>
      ) : (
        <input
          type="hidden"
          name="effectiveClosedAt"
          value={defaults.effectiveClosedAt ?? ""}
        />
      )}

      <div className="field form-submit">
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? "Guardando…" : `Guardar seguimiento ${versionLabel(nextSequenceNumber)}`}
        </button>
      </div>
    </form>
  );
}
