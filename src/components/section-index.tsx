"use client";
import { useEffect, useState } from "react";
import { sectionAnchorId } from "@/lib/ui/section-anchor";

type Entry = { id: string; title: string };
const SECTIONS = "section.form-section, section.card, fieldset.form-section";

/** Apartados de primer nivel del contenedor: secciones que no están dentro de otra sección del mismo contenedor. */
function collect(root: HTMLElement): Entry[] {
  const used = new Set(Array.from(document.querySelectorAll("[id]"), element => element.id));
  return Array.from(root.querySelectorAll<HTMLElement>(SECTIONS)).flatMap(section => {
    const outer = section.parentElement?.closest(SECTIONS);
    if (outer && root.contains(outer)) return [];
    const title = (section.querySelector("h2") ?? section.querySelector("legend"))?.textContent?.trim();
    if (!title) return [];
    if (!section.id) section.id = sectionAnchorId(title, used);
    return [{ id: section.id, title }];
  });
}

/**
 * Índice lateral de apartados (D-111, V2): se construye con los títulos que ya tiene el formulario o la ficha,
 * marca el apartado visible y baja hasta el que se pulsa. No toca campos, orden ni guardado.
 */
export function SectionIndex({ targetId, label = "Apartados del formulario" }: { targetId: string; label?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const refresh = () => setEntries(previous => {
      const next = collect(root);
      return JSON.stringify(next) === JSON.stringify(previous) ? previous : next;
    });
    refresh();
    const mutations = new MutationObserver(refresh);
    mutations.observe(root, { childList: true, subtree: true });
    return () => mutations.disconnect();
  }, [targetId]);

  useEffect(() => {
    if (!entries.length) return;
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(changes => {
      for (const change of changes) visible.set(change.target.id, change.isIntersecting);
      const first = entries.find(entry => visible.get(entry.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-120px 0px -60% 0px" });
    for (const entry of entries) { const element = document.getElementById(entry.id); if (element) observer.observe(element); }
    return () => observer.disconnect();
  }, [entries]);

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
