"use client";
import { createContext, useContext, type ReactNode } from "react";
const CsrfContext = createContext("");
export function CsrfProvider({ token, children }: { token: string; children: ReactNode }) {
  return <CsrfContext.Provider value={token}>{children}</CsrfContext.Provider>;
}
// Included in the initial server-rendered HTML, including before hydration.
// This token grants no permission; the server binds it to the verified session.
export function CsrfField({ requestId }: { requestId?: string } = {}) {
  return <><input type="hidden" name="_covexCsrf" value={useContext(CsrfContext)}/>{requestId && <input type="hidden" name="_covexAuditRequestId" value={requestId}/>}</>;
}
