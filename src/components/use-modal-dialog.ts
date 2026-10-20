"use client";

import { useEffect, useRef } from "react";

const focusable = "a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

/**
 * Ventanas modales (D-117, H-01): el foco entra en la ventana, queda retenido con Tab,
 * Esc la cierra y, al cerrar, vuelve al control que la abrió.
 */
export function useModalDialog<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(focusable)).filter((item) => item.offsetParent !== null);
    (node.querySelector<HTMLElement>("[autofocus],textarea,input:not([type=hidden]),select") ?? items()[0] ?? node).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (event.shiftKey && (document.activeElement === first || !node!.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !node!.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  return ref;
}
