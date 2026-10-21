"use client";

import { useEffect, useRef, useState } from "react";
import { sectionAnchorId } from "@/lib/ui/section-anchor";
import { SECTIONS } from "./section-index";

type Problem = { id: string; target?: string; label: string; message: string; sectionId: string | null; section: string };
type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

let generated = 0;

function fieldLabel(element: Control) {
  const group = element.type === "checkbox" || element.type === "radio" ? element.closest(".field")?.querySelector(":scope > span")?.textContent : null;
  const text = group
    ?? element.closest("label")?.querySelector(":scope > span")?.textContent
    ?? (element.id ? element.ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : null)
    ?? element.getAttribute("aria-label")
    ?? element.closest("fieldset")?.querySelector("legend")?.textContent
    ?? element.name;
  return text.replace(/\s*\*\s*$/, "").trim() || "Campo";
}

/** Apartado del formulario que contiene el campo: el mismo que muestra el índice lateral (D-111, V2). */
function fieldSection(element: Control, form: HTMLFormElement) {
  let section: HTMLElement | null = null;
  for (let node = element.closest<HTMLElement>(SECTIONS); node && form.contains(node); node = node.parentElement?.closest<HTMLElement>(SECTIONS) ?? null) section = node;
  const title = (section?.querySelector("h2") ?? section?.querySelector(":scope > legend"))?.textContent?.trim();
  if (!section || !title) return { sectionId: null, section: "Otros campos" };
  if (!section.id) section.id = sectionAnchorId(title, new Set(Array.from(document.querySelectorAll("[id]"), node => node.id)));
  return { sectionId: section.id, section: title };
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
export function InvalidFieldsSummary({ serverIssues }: { serverIssues?: Record<string, string[]> } = {}) {
  const box = useRef<HTMLDivElement>(null);
  const [problems, setProblems] = useState<Problem[]>([]);

  // D-117: errores devueltos por el servidor para un campo concreto; se marcan y se listan igual que los del navegador.
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form || !serverIssues || !Object.keys(serverIssues).length) return;
    const list: Problem[] = [];
    for (const [name, messages] of Object.entries(serverIssues)) {
      const element = form.querySelector<Control>(`[name="${CSS.escape(name)}"]`);
      if (!element) continue;
      const hidden = element.type === "hidden";
      const target: HTMLElement = hidden ? element.closest<HTMLElement>(SECTIONS) ?? element : element;
      if (!target.id) target.id = `campo-${++generated}`;
      if (!hidden) element.setAttribute("aria-invalid", "true");
      const section = fieldSection(element, form);
      const label = hidden ? section.section : fieldLabel(element);
      messages.forEach((message, index) => list.push({ id: index ? `${target.id}#${index}` : target.id, target: target.id, label, message, ...section }));
    }
    if (!list.length) return;
    form.classList.add("show-required-errors");
    setProblems(list);
    requestAnimationFrame(() => box.current?.focus());
  }, [serverIssues]);

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
      collected.push({ id: element.id, label: fieldLabel(element), message: fieldMessage(element), ...fieldSection(element, form!) });
    }

    function onChange(event: Event) {
      const element = event.target as Control;
      if (!element.willValidate || element.getAttribute("aria-invalid") !== "true" || !element.checkValidity()) return;
      element.removeAttribute("aria-invalid");
      setProblems((current) => current.filter((problem) => (problem.target ?? problem.id) !== element.id && !((element.type === "radio" || element.type === "checkbox") && problem.label === fieldLabel(element))));
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

  // D-117 (N-01): los pendientes se agrupan por apartado, en el orden del formulario, con enlace al apartado y a cada campo.
  const groups = problems.reduce<{ key: string; sectionId: string | null; section: string; items: Problem[] }[]>((list, problem) => {
    const key = problem.sectionId ?? problem.section;
    const group = list.find((item) => item.key === key);
    if (group) group.items.push(problem); else list.push({ key, sectionId: problem.sectionId, section: problem.section, items: [problem] });
    return list;
  }, []);
  const go = (id: string) => (event: React.MouseEvent) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.closest("details")?.setAttribute("open", "");
    target.scrollIntoView({ block: target.matches("input, select, textarea") ? "center" : "start" });
    if (target.matches("input, select, textarea")) target.focus();
  };
  const allMissing = problems.every((problem) => problem.message === "es obligatorio.");
  const heading = problems.length === 1
    ? (allMissing ? "Falta completar 1 campo obligatorio antes de guardar." : "Revisa 1 campo antes de guardar.")
    : allMissing ? `Faltan ${problems.length} campos obligatorios antes de guardar.` : `Revisa ${problems.length} campos antes de guardar.`;

  return <div ref={box} tabIndex={-1} className={problems.length ? "form-errors invalid-fields-summary" : undefined} role={problems.length ? "alert" : undefined} hidden={!problems.length}>
    {problems.length ? <>
      <strong>{heading}</strong>
      <ul>{groups.map((group) => <li key={group.key}>
        {group.sectionId ? <a className="invalid-section-link" href={`#${group.sectionId}`} onClick={go(group.sectionId)}>{group.section}</a> : <span className="invalid-section-link">{group.section}</span>}
        {" "}({group.items.length}):{" "}
        {group.items.map((problem, index) => <span key={problem.id}>
          {index ? ", " : null}
          <a className="invalid-field-link" href={`#${problem.target ?? problem.id}`} onClick={go(problem.target ?? problem.id)}>{problem.label}</a>
          {problem.message === "es obligatorio." ? null : problem.target ? <> — <span className="invalid-field-message">{problem.message}</span></> : ` (${problem.message.replace(/\.$/, "")})`}
        </span>)}
      </li>)}</ul>
    </> : null}
  </div>;
}
