"use client";

import { useEffect, useRef } from "react";

/**
 * Indicio de desplazamiento (D-117, N-02): marca `data-overflow` cuando el contenido no cabe y
 * `data-at-end` al llegar al final, para que el CSS difumine el borde solo cuando hay más a la derecha.
 */
export function useScrollHint<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    const update = () => {
      node.dataset.overflow = String(node.scrollWidth > node.clientWidth + 1);
      node.dataset.atEnd = String(node.scrollLeft + node.clientWidth >= node.scrollWidth - 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); node.removeEventListener("scroll", update); };
  }, [enabled]);
  return ref;
}
