"use client";

import { useState } from "react";
import { formatAdministrativeDate } from "@/lib/qms/administrative-date";

export function QmsAdministrativeStatus({
  qmsRecordId,
  isActive,
  code,
  annulledAt,
  annulledByText,
  annulledReason,
  defaultActor,
  reservesHistoricalCode = false,
}: {
  qmsRecordId: string;
  isActive: boolean;
  code: string;
  annulledAt?: string | null;
  annulledByText?: string | null;
  annulledReason?: string | null;
  defaultActor: string;
  reservesHistoricalCode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actor, setActor] = useState(defaultActor);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const action = isActive ? "ANNUL" : "REACTIVATE";
  const label = isActive ? "Anular expediente" : "Reactivar expediente";

  async function submit() {
    if (reason.trim().length < 3) {
      setError("Indica un motivo de al menos 3 caracteres.");
      return;
    }
    if (!actor.trim()) {
      setError("Indica el usuario que realiza la acción.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/qms/${qmsRecordId}/administrative-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reason.trim(),
          actor: actor.trim(),
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "No se ha podido completar la operación.");
        return;
      }
      window.location.reload();
    } catch {
      setError("No se ha podido completar la operación.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {!isActive ? (
        <div className="annulled-record-banner">
          <div>
            <strong>Expediente anulado</strong>
            <span>
              {code}
              {annulledAt ? ` · ${formatAdministrativeDate(annulledAt)}` : ""}
              {annulledByText ? ` · ${annulledByText}` : ""}
            </span>
            {annulledReason ? <small>Motivo: {annulledReason}</small> : null}
          </div>
          <button type="button" className="button" onClick={() => setOpen(true)}>
            Reactivar expediente
          </button>
        </div>
      ) : (
        <button type="button" className="button danger" onClick={() => setOpen(true)}>
          Anular expediente
        </button>
      )}

      {open ? (
        <div className="manual-reminder-backdrop" role="presentation">
          <div className="manual-reminder-dialog" role="dialog" aria-modal="true">
            <div className="manual-reminder-dialog-heading">
              <div>
                <p className="eyebrow">Estado administrativo</p>
                <h2>{label}</h2>
                <p>
                  {isActive
                    ? reservesHistoricalCode ? "El expediente se conserva para trazabilidad y deja de aparecer en el listado habitual. Su código histórico queda reservado." : "El expediente se conservará para trazabilidad, dejará de aparecer en los listados habituales y su codificación quedará disponible para reutilización."
                    : "La reactivación recuperará la codificación original solo si no ha sido reutilizada por otro expediente activo."}
                </p>
              </div>
              <button type="button" className="button small" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>

            <div className="manual-reminder-form">
              <label className="field full">
                <span>Motivo</span>
                <textarea
                  rows={5}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={isActive ? "Ej.: expediente creado por error / duplicado..." : "Motivo de la reactivación"}
                />
              </label>
              <label className="field full">
                <span>Realizado por</span>
                <input value={actor} onChange={(event) => setActor(event.target.value)} />
              </label>
              {error ? <div className="form-errors full">{error}</div> : null}
            </div>

            <div className="manual-reminder-dialog-footer">
              <span className="muted-note">
                Esta acción no borra físicamente el expediente ni sus relaciones, versiones, documentos o historial.
              </span>
              <button
                type="button"
                className={isActive ? "button danger" : "button primary"}
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Guardando…" : label}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
