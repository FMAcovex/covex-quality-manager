"use client";

import { useEffect, useRef, useState } from "react";

/** Keep a deterministic comparison, including dynamic arrays stored in hidden inputs. */
export function formSignature(form: HTMLFormElement): string {
  return JSON.stringify(Array.from(new FormData(form), ([name, value]) => [
    name,
    typeof value === "string" ? value : [value.name, value.size, value.lastModified],
  ]));
}

export function needsExitConfirmation({
  interacted,
  changed,
  saveError,
  submitting,
}: {
  interacted: boolean;
  changed: boolean;
  saveError: boolean;
  submitting: boolean;
}): boolean {
  return !submitting && (saveError || (interacted && changed));
}

/**
 * Lightweight guard scoped to the closest form. No autosave and no changes to
 * any Server Action or GMP validation. Browser-provided beforeunload copy is
 * used for reload/close; same-document links and Back use a confirm prompt.
 */
export function UnsavedChangesGuard({
  pending = false,
  saveError = false,
}: {
  pending?: boolean;
  saveError?: boolean;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const pendingRef = useRef(pending);
  const saveErrorRef = useRef(saveError);
  pendingRef.current = pending;
  saveErrorRef.current = saveError;
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;

    const original = formSignature(form);
    let interacted = false;
    let submitting = false;

    const hasChanges = () =>
      needsExitConfirmation({
        interacted,
        changed: formSignature(form) !== original,
        saveError: saveErrorRef.current,
        submitting: submitting || pendingRef.current,
      });

    const onInteraction = () => {
      interacted = true;
      // A dynamic add/remove button may commit controlled React state at the
      // end of this event. The final check always reads FormData on exit.
      requestAnimationFrame(() => setDirty(hasChanges()));
    };
    const onFormClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('button[type="button"]')) onInteraction();
    };
    const onSubmit = () => {
      submitting = true;
      setDirty(false);
    };
    const onSaveError = () => {
      submitting = false;
      interacted = true;
      setDirty(true);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link || link.hasAttribute("download") || (link.getAttribute("target") && link.getAttribute("target") !== "_self")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.pathname.startsWith("/api/")) return; // Downloads do not leave the form.
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;
      if (!hasChanges()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (window.confirm("Hay cambios sin guardar. ¿Quieres abandonar el formulario y descartarlos?")) {
        submitting = true;
        window.location.assign(destination.href);
      }
    };

    // A synthetic, same-URL history entry protects browser Back during edit.
    // It does not alter the displayed URL and requires no persistent storage.
    let historyGuarded = false;
    try {
      window.history.pushState({ ...window.history.state, __qmsUnsavedGuard: true }, "", window.location.href);
      historyGuarded = true;
    } catch {
      // beforeunload and link protection remain available.
    }
    const onPopState = () => {
      if (!historyGuarded) return;
      if (hasChanges() && !window.confirm("Hay cambios sin guardar. ¿Quieres abandonar el formulario y descartarlos?")) {
        window.history.pushState({ ...window.history.state, __qmsUnsavedGuard: true }, "", window.location.href);
        return;
      }
      submitting = true;
      window.removeEventListener("popstate", onPopState);
      window.history.back();
    };

    form.addEventListener("input", onInteraction);
    form.addEventListener("change", onInteraction);
    form.addEventListener("click", onFormClick);
    form.addEventListener("submit", onSubmit);
    form.addEventListener("qms:save-error", onSaveError);
    document.addEventListener("click", onNavigationClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    if (historyGuarded) window.addEventListener("popstate", onPopState);

    return () => {
      form.removeEventListener("input", onInteraction);
      form.removeEventListener("change", onInteraction);
      form.removeEventListener("click", onFormClick);
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("qms:save-error", onSaveError);
      document.removeEventListener("click", onNavigationClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!pending && saveError) {
      setDirty(true);
      const form = anchorRef.current?.closest("form");
      form?.dispatchEvent(new Event("qms:save-error"));
      const summary = form?.querySelector<HTMLElement>(".form-errors");
      if (summary) {
        window.requestAnimationFrame(() => {
          summary.setAttribute("tabindex", "-1");
          summary.focus({ preventScroll: false });
        });
      }
    }
  }, [pending, saveError]);

  return (
    <>
      <span ref={anchorRef} hidden aria-hidden="true" />
      {dirty && !pending && !saveError ? (
        <p className="muted-note" role="status">Hay cambios sin guardar. Guarda antes de salir para conservarlos.</p>
      ) : null}
    </>
  );
}
