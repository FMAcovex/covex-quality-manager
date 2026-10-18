"use client";

import { useEffect, useRef, useState } from "react";

const SHOW_AFTER_MS = 120;
const GIVE_UP_AFTER_MS = 20000;

/** Enlace interno que provoca una navegación de la aplicación (no descargas ni pestañas nuevas). */
function navigationTarget(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return null;
  const current = window.location.pathname + window.location.search;
  if (url.pathname + url.search === current) return null;
  return url;
}

/**
 * Barra fina de progreso al cambiar de apartado (D-104). Sustituye en las navegaciones a la
 * pantalla «Cargando información…», que React mantenía un mínimo de unos 300 ms en cada clic aunque
 * la página ya hubiera llegado. Solo aparece si la navegación tarda más de 120 ms y desaparece en
 * cuanto cambia la dirección, que es cuando la página nueva ya está pintada.
 */
export function NavigationProgress() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timers = useRef<number[]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
    const finish = () => {
      clear();
      setState((current) => (current === "loading" ? "done" : "idle"));
      timers.current.push(window.setTimeout(() => setState("idle"), 300));
    };
    const onClick = (event: MouseEvent) => {
      if (!navigationTarget(event)) return;
      clear();
      const startHref = window.location.href;
      timers.current.push(window.setTimeout(() => setState("loading"), SHOW_AFTER_MS));
      timers.current.push(window.setTimeout(finish, GIVE_UP_AFTER_MS));
      // La dirección cambia cuando la aplicación pinta la página nueva.
      const watch = () => {
        if (window.location.href !== startHref) finish();
        else frame.current = window.requestAnimationFrame(watch);
      };
      frame.current = window.requestAnimationFrame(watch);
    };
    // En captura: los enlaces de Next cancelan el clic nativo antes de que llegue al documento.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);

  return <div className="nav-progress" data-state={state} aria-hidden="true" />;
}
