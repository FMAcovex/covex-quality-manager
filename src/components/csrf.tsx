"use client";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
const CsrfContext = createContext("");
export function CsrfProvider({ token, children }: { token: string; children: ReactNode }) {
  return <CsrfContext.Provider value={token}>{children}</CsrfContext.Provider>;
}
// Included in the initial server-rendered HTML, including before hydration.
// This token grants no permission; the server binds it to the verified session.
export function CsrfField({ requestId }: { requestId?: string } = {}) {
  const input = useRef<HTMLInputElement>(null);
  const last = useRef<{ signature: string; id: string } | null>(null);
  useEffect(() => {
    const element = input.current, form = element?.form;
    if (!element || !form) return;
    const submit = (event: SubmitEvent) => {
      const fields = [...new FormData(form, event.submitter).entries()]
        .filter(([key]) => !/^_covex|^\$ACTION_/.test(key))
        .map(([key, value]) => [key, typeof value === "string" ? value : { name: value.name, size: value.size, type: value.type, lastModified: value.lastModified }]);
      const signature = JSON.stringify(fields);
      const id = last.current?.signature === signature ? last.current.id : !last.current && requestId ? requestId : crypto.randomUUID();
      last.current = { signature, id }; element.value = id;
    };
    // Repeating the same explicit submission after a lost response keeps its
    // nonce; a changed command gets a new one. No automatic business save.
    form.addEventListener("submit", submit, { capture: true });
    return () => form.removeEventListener("submit", submit, { capture: true });
  }, [requestId]);
  return <><input type="hidden" name="_covexCsrf" value={useContext(CsrfContext)}/><input ref={input} type="hidden" name="_covexAuditRequestId" defaultValue={requestId ?? ""}/></>;
}
