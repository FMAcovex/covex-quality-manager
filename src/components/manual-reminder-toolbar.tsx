"use client";

import { authenticatedFetch } from "@/lib/auth/client";

import { useEffect, useState } from "react";

type ReminderRecord = {
  id: string;
  code: string;
  summary: string;
  status: string;
  meta: string;
  href: string;
};

function readRecord(input: HTMLInputElement): ReminderRecord {
  return {
    id: input.dataset.reminderId ?? "",
    code: input.dataset.reminderCode ?? "Sin código",
    summary: input.dataset.reminderSummary ?? "",
    status: input.dataset.reminderStatus ?? "",
    meta: input.dataset.reminderMeta ?? "",
    href: input.dataset.reminderHref ?? "",
  };
}

function parseRecipients(value: string) {
  return value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function invalidEmails(values: string[]) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return values.filter((value) => !emailPattern.test(value));
}

export function ManualReminderToolbar({
  tableId,
  moduleLabel,
  hideWhenEmpty = false,
}: {
  tableId: string;
  moduleLabel: string;
  /** Solo aparece al seleccionar expedientes (piloto de listados con menos ruido visual). */
  hideWhenEmpty?: boolean;
}) {
  const [selected, setSelected] = useState<ReminderRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rowInputs = () =>
      Array.from(
        table.querySelectorAll<HTMLInputElement>('input[data-reminder-record="true"]'),
      );

    const selectAll = () =>
      table.querySelector<HTMLInputElement>('input[data-reminder-select-all="true"]');

    const sync = () => {
      const inputs = rowInputs();
      const checked = inputs.filter((input) => input.checked);
      setSelected(checked.map(readRecord));

      const header = selectAll();
      if (header) {
        header.checked = inputs.length > 0 && checked.length === inputs.length;
        header.indeterminate = checked.length > 0 && checked.length < inputs.length;
      }
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.dataset.reminderSelectAll === "true") {
        rowInputs().forEach((input) => {
          input.checked = target.checked;
        });
      }

      if (
        target.dataset.reminderSelectAll === "true" ||
        target.dataset.reminderRecord === "true"
      ) {
        sync();
      }
    };

    table.addEventListener("change", onChange);
    sync();

    return () => {
      table.removeEventListener("change", onChange);
    };
  }, [tableId]);

  const openComposer = () => {
    if (!selected.length) return;

    const origin = window.location.origin;
    const nextSubject =
      selected.length === 1
        ? `Recordatorio · ${selected[0]?.code ?? moduleLabel}`
        : `Recordatorio · ${moduleLabel} · ${selected.length} expedientes`;

    const separator = "────────────────────────────────────────";
    const recordsText = selected
      .map((record, index) => {
        const lines = [
          selected.length > 1 ? `${index + 1}. ${record.code}` : record.code,
          record.status ? `Estado: ${record.status}` : "",
          record.meta ? `Departamento / Área: ${record.meta}` : "",
          record.summary ? "" : "",
          record.summary ? "Descripción:" : "",
          record.summary ? record.summary : "",
          record.href ? "" : "",
          record.href ? "Acceso al expediente:" : "",
          record.href ? `${origin}${record.href}` : "",
        ].filter((line, lineIndex, source) => {
          if (line !== "") return true;
          return lineIndex > 0 && source[lineIndex - 1] !== "";
        });

        return [separator, ...lines, separator].join("\n");
      })
      .join("\n\n");

    const nextBody = [
      "Buenos días,",
      "",
      selected.length === 1
        ? "Se envía un recordatorio de seguimiento sobre el siguiente expediente del Sistema de Calidad de COVEX:"
        : "Se envía un recordatorio de seguimiento sobre los siguientes expedientes del Sistema de Calidad de COVEX:",
      "",
      "EXPEDIENTES",
      recordsText,
      "",
      "ACCIÓN SOLICITADA",
      "Por favor, revisad el estado del expediente y actualizad o completad las acciones pendientes que correspondan.",
      "",
      "Gracias.",
    ].join("\n");

    setSubject(nextSubject);
    setBody(nextBody);
    setError(null);
    setIsOpen(true);
  };

  const openMailClient = async () => {
    const toList = parseRecipients(to);
    const ccList = parseRecipients(cc);

    if (!toList.length) {
      setError("Indica al menos un destinatario.");
      return;
    }

    const invalid = [...invalidEmails(toList), ...invalidEmails(ccList)];
    if (invalid.length) {
      setError(`Revisa estas direcciones de correo: ${invalid.join(", ")}`);
      return;
    }

    if (!subject.trim()) {
      setError("El asunto no puede estar vacío.");
      return;
    }

    const query = new URLSearchParams();
    query.set("subject", subject.trim());
    query.set("body", body);
    if (ccList.length) query.set("cc", ccList.join(","));

    const mailto = `mailto:${toList.join(",")}?${query.toString()}`;

    setIsPreparing(true);
    setError(null);

    try {
      const response = await authenticatedFetch("/api/reminders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIds: selected.map((record) => record.id),
          recipients: toList,
          ccRecipients: ccList,
          subject: subject.trim(),
          message: body,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(result?.error ?? "No se ha podido registrar el recordatorio.");
        return;
      }

      window.location.href = mailto;
    } catch {
      setError("No se ha podido registrar el recordatorio. Inténtalo de nuevo.");
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <>
      {hideWhenEmpty && !selected.length ? null : <div className="manual-reminder-bar">
        <div className="manual-reminder-copy">
          <strong>Recordatorios por correo</strong>
          <span>
            Selecciona uno o varios expedientes del listado y prepara un correo manual.
          </span>
        </div>
        <div className="manual-reminder-actions">
          <span className="manual-reminder-count">
            {selected.length
              ? `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}`
              : "Ningún expediente seleccionado"}
          </span>
          <button
            type="button"
            className="button"
            onClick={openComposer}
            disabled={!selected.length}
          >
            Preparar recordatorio
          </button>
        </div>
      </div>}

      {isOpen ? (
        <div
          className="manual-reminder-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="manual-reminder-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-reminder-title"
          >
            <div className="manual-reminder-dialog-heading">
              <div>
                <p className="eyebrow">Recordatorio manual</p>
                <h2 id="manual-reminder-title">Preparar correo</h2>
                <p>
                  Se abrirá la aplicación de correo configurada en el equipo. Puedes
                  revisar y modificar el mensaje antes de enviarlo.
                </p>
              </div>
              <button
                type="button"
                className="button small"
                onClick={() => setIsOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="manual-reminder-selected">
              <strong>Expedientes incluidos</strong>
              <div className="manual-reminder-chips">
                {selected.map((record) => (
                  <span key={record.id}>{record.code}</span>
                ))}
              </div>
            </div>

            <div className="manual-reminder-form">
              <label className="field full">
                <span>Para</span>
                <input
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="persona@empresa.com; otra@empresa.com"
                  autoFocus
                />
                <small className="muted-note">
                  Puedes separar varias direcciones con punto y coma, coma o espacio.
                </small>
              </label>

              <label className="field full">
                <span>CC (opcional)</span>
                <input
                  value={cc}
                  onChange={(event) => setCc(event.target.value)}
                  placeholder="copia@empresa.com"
                />
              </label>

              <label className="field full">
                <span>Asunto</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>

              <label className="field full">
                <span>Mensaje</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={14}
                />
              </label>

              {error ? <div className="form-errors full">{error}</div> : null}
            </div>

            <div className="manual-reminder-dialog-footer">
              <span className="muted-note">
                La preparación queda registrada en el expediente. El envío real se
                realiza desde Outlook o el cliente de correo del usuario.
              </span>
              <button
                type="button"
                className="button primary"
                onClick={openMailClient}
                disabled={isPreparing}
              >
                {isPreparing ? "Preparando…" : "Abrir correo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
