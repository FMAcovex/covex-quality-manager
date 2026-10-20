"use client";

import { useEffect, useRef, useState } from "react";

type Problem = { id: string; label: string; message: string };
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

let generated = 0;

function fieldLabel(element: Control) {
  const text = element.closest("label")?.querySelector(":scope > span")?.textContent
    ?? (element.id ? element.ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : null)
    ?? element.getAttribute("aria-label")
    ?? element.closest("fieldset")?.querySelector("legend")?.textContent
    ?? element.name;
  return text.replace(/\s*\*\s*$/, "").trim() || "Campo";
}

function fieldMessage(element: Control) {
  if (element.validity.valueMissing) return "es obligatorio.";
  if (element.validity.typeMismatch || element.validity.badInput || element.validity.patternMismatch) return "no tiene un formato válido.";
  if (element.validity.tooLong) return "supera la longitud permitida.";
  if (element.validity.rangeUnderflow || element.validity.rangeOverflow) return "está fuera del rango permitido.";
  return "no es válido.";
}

/**
 * Resumen de campos pendientes (D-117, H-09). Al intentar guardar, en vez del aviso del navegador
 * campo a campo, lista en español todos los campos que faltan con un enlace a cada uno. La
 * validación del navegador y la del servidor no cambian; este componente solo las explica.
 */
export function InvalidFieldsSummary() {
  const box = useRef<HTMLDivElement>(null);
  const [problems, setProblems] = useState<Problem[]>([]);

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    let collected: Problem[] | null = null;
    const seen = new Set<string>();

    function onInvalid(event: Event) {
      const element = event.target as Control;
      event.preventDefault();
      element.setAttribute("aria-invalid", "true");
      form!.classList.add("show-required-errors");
      if (!element.id) element.id = `campo-${++generated}`;
      if (!collected) {
        collected = [];
        seen.clear();
        // El navegador lanza un «invalid» por campo y vacía las microtareas entre uno y otro: se agrupan en una tarea.
        window.setTimeout(() => {
          const list = collected ?? [];
          collected = null;
          setProblems(list);
          requestAnimationFrame(() => box.current?.focus());
        }, 0);
      }
      const key = element.type === "radio" ? `radio:${element.name}` : element.id;
      if (seen.has(key)) return;
      seen.add(key);
      collected.push({ id: element.id, label: fieldLabel(element), message: fieldMessage(element) });
    }

    function onChange(event: Event) {
      const element = event.target as Control;
      if (!element.willValidate || element.getAttribute("aria-invalid") !== "true" || !element.checkValidity()) return;
      element.removeAttribute("aria-invalid");
      setProblems((current) => current.filter((problem) => problem.id !== element.id && !(element.type === "radio" && problem.label === fieldLabel(element))));
    }

    const onSubmit = () => setProblems([]);
    form.addEventListener("invalid", onInvalid, true);
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("invalid", onInvalid, true);
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, []);

  return <div ref={box} tabIndex={-1} className={problems.length ? "form-errors invalid-fields-summary" : undefined} role={problems.length ? "alert" : undefined} hidden={!problems.length}>
    {problems.length ? <>
      <strong>{problems.length === 1 ? "Falta completar 1 campo antes de guardar." : `Faltan ${problems.length} campos por completar antes de guardar.`}</strong>
      <ul>{problems.map((problem) => <li key={problem.id}>
        <a href={`#${problem.id}`} onClick={(event) => {
          const target = document.getElementById(problem.id);
          if (!target) return;
          event.preventDefault();
          target.closest("details")?.setAttribute("open", "");
          target.scrollIntoView({ block: "center" });
          target.focus();
        }}>{problem.label}</a> {problem.message}
      </li>)}</ul>
    </> : null}
  </div>;
}
