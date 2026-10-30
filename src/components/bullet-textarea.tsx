"use client";
import { useRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import { continueBullet, toggleBullets, type TextEdit } from "@/lib/forms/bullets";

function applyEdit(textarea: HTMLTextAreaElement, edit: TextEdit) {
  textarea.focus();
  if (edit.from !== edit.to || edit.text) {
    textarea.setSelectionRange(edit.from, edit.to);
    // insertText deja el cambio en el historial de deshacer (Ctrl+Z) del navegador.
    const done = edit.text ? document.execCommand("insertText", false, edit.text) : document.execCommand("delete");
    if (!done) {
      textarea.setRangeText(edit.text, edit.from, edit.to, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}

/**
 * D-126: campo de texto largo con viñetas. El botón «• Viñetas» pone o quita «• » en las líneas
 * seleccionadas e Intro continúa la lista (en una viñeta vacía, la termina). Se guarda como texto.
 */
export function BulletTextarea({ id, label, fieldLabel, help, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  /** Contenido de la etiqueta visible (con el asterisco si es obligatorio). */
  label: ReactNode;
  /** Nombre del campo para el botón («Viñetas en «…»»). */
  fieldLabel: string;
  help?: ReactNode;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <>
      <div className="text-field-head">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="button small text-tool"
          aria-label={`Viñetas en «${fieldLabel}»`}
          title="Pone o quita viñetas en las líneas seleccionadas"
          disabled={props.disabled || props.readOnly}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const textarea = ref.current;
            if (textarea) applyEdit(textarea, toggleBullets(textarea.value, textarea.selectionStart, textarea.selectionEnd));
          }}
        >
          • Viñetas
        </button>
      </div>
      {help}
      <textarea
        {...props}
        id={id}
        ref={ref}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
          const textarea = event.currentTarget;
          const edit = continueBullet(textarea.value, textarea.selectionStart, textarea.selectionEnd);
          if (!edit) return;
          event.preventDefault();
          applyEdit(textarea, edit);
        }}
      />
    </>
  );
}
