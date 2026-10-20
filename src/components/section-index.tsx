"use client";
import { useEffect, useState } from "react";
import { sectionAnchorId } from "@/lib/ui/section-anchor";

type Entry = { id: string; title: string };
type Found = { entries: Entry[]; elements: HTMLElement[] };
const SECTIONS = "section.form-section, section.card, fieldset.form-section, section.deviation-part";

/** Apartados visibles de primer nivel del contenedor: no ocultos y no dentro de otra sección del mismo contenedor. */
function collect(root: HTMLElement): Found {
  const used = new Set(Array.from(document.querySelectorAll("[id]"), element => element.id));
  const found: Found = { entries: [], elements: [] };
  for (const section of Array.from(root.querySelectorAll<HTMLElement>(SECTIONS))) {
    const outer = section.parentElement?.closest(SECTIONS);
    if (outer && root.contains(outer)) continue;
    if (!section.getClientRects().length) continue;
    const title = (section.querySelector("h2") ?? section.querySelector(":scope > legend"))?.textContent?.trim();
    if (!title) continue;
    if (!section.id) section.id = sectionAnchorId(title, used);
    found.entries.push({ id: section.id, title });
    found.elements.push(section);
  }
  return found;
}

/**
 * Índice lateral de apartados (D-111, V2): se construye con los títulos que ya tiene el formulario o la ficha,
 * marca el apartado visible y baja hasta el que se pulsa. No toca campos, orden ni guardado.
 */
export function SectionIndex({ targetId, label = "Apartados del formulario" }: { targetId: string; label?: string }) {
  const [found, setFound] = useState<Found>({ entries: [], elements: [] });
  const [active, setActive] = useState<string | null>(null);
  const entries = found.entries;

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    let current: Found = { entries: [], elements: [] };
    const refresh = () => {
      const next = collect(root);
      // Al volver a montarse el formulario (p. ej. tras un error) los ids coinciden pero los nodos son otros.
      const same = next.elements.length === current.elements.length && next.elements.every((element, index) => element === current.elements[index])
        && JSON.stringify(next.entries) === JSON.stringify(current.entries);
      if (same) return;
      current = next;
      setFound(next);
    };
    refresh();
    const mutations = new MutationObserver(refresh);
    mutations.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
    return () => mutations.disconnect();
  }, [targetId]);

  useEffect(() => {
    if (!found.elements.length) return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(changes => {
      for (const change of changes) visible.set(change.target.id, change.isIntersecting);
      const first = found.entries.find(entry => visible.get(entry.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-120px 0px -60% 0px" });
    for (const element of found.elements) observer.observe(element);
    return () => observer.disconnect();
  }, [found]);

  if (!entries.length) return <nav className="section-index" aria-label={label} hidden />;
  return <nav className="section-index" aria-label={label}>
    <p className="section-index-title">Apartados</p>
    <ol>{entries.map(entry => <li key={entry.id}><a href={`#${entry.id}`} aria-current={active === entry.id ? "true" : undefined} onClick={event => {
      const element = document.getElementById(entry.id);
      if (!element) return;
      event.preventDefault();
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(history.state, "", `#${entry.id}`);
      setActive(entry.id);
    }}>{entry.title}</a></li>)}</ol>
  </nav>;
}
