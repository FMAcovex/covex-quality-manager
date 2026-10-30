"use client";
import { useId, useRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import { continueBullet, toggleBullets, type TextEdit } from "@/lib/forms/bullets";
import type { TextTable } from "@/lib/forms/text-tables";
import { TextTablesEditor } from "./text-tables-editor";

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
export function BulletTextarea({ id, label, fieldLabel, help, after, tables, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  /** Contenido de la etiqueta visible (con el asterisco si es obligatorio). */
  label: ReactNode;
  /** Nombre del campo para el botón («Viñetas en «…»»). */
  fieldLabel: string;
  /** Ayuda bajo la etiqueta y nota o error bajo el campo: se anuncian con el campo (aria-describedby). */
  help?: ReactNode;
  after?: ReactNode;
  /** D-127: tablas del campo (solo en los campos que las admiten; requiere `name`). */
  tables?: TextTable[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const describedBy = [props["aria-describedby"], help ? `${id}-help` : null, after ? `${id}-after` : null].filter(Boolean).join(" ") || undefined;
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
      {help ? <div id={`${id}-help`} className="text-field-note">{help}</div> : null}
      <textarea
        {...props}
        id={id}
        ref={ref}
        aria-describedby={describedBy}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          // keyCode 229: Intro que confirma una composición (IME) en Safari.
          if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          const textarea = event.currentTarget;
          const edit = continueBullet(textarea.value, textarea.selectionStart, textarea.selectionEnd);
          if (!edit) return;
          event.preventDefault();
          applyEdit(textarea, edit);
        }}
      />
      {tables && typeof props.name === "string" ? <TextTablesEditor field={props.name} fieldLabel={fieldLabel} initial={tables} /> : null}
      {after ? <div id={`${id}-after`} className="text-field-note">{after}</div> : null}
    </>
  );
}

/** Campo completo (contenedor `.field`, etiqueta, ayuda y texto con viñetas) para los formularios. */
export function BulletTextField({ label, className = "field full", requiredMark, hidden, children, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  help?: ReactNode;
  className?: string;
  /** Muestra « *» aunque el navegador no exija el campo (obligatorio solo al cerrar, etc.). */
  requiredMark?: boolean;
  /** Nota o error bajo el campo; se anuncia con él. */
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={className} hidden={hidden}>
      <BulletTextarea id={id} label={<>{label}{requiredMark ?? props.required ? " *" : ""}</>} fieldLabel={label} after={children} {...props} />
    </div>
  );
}

