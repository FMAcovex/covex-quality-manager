"use client";

import { createContext, useContext, type ReactNode, type InputHTMLAttributes } from "react";
import type { AccessModule, AccessPermission } from "@/lib/auth/context";
import type { PresentationAccess } from "@/lib/auth/presentation";

const Context = createContext<PresentationAccess | null>(null);
export function PermissionProvider({ value, children }: { value: PresentationAccess; children?: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePresentationAccess() { return useContext(Context); }
export function ActorField(props: InputHTMLAttributes<HTMLInputElement>) {
  const access = usePresentationAccess();
  return <input {...props} defaultValue={undefined} value={access?.actor ?? ""} onChange={undefined} readOnly />;
}
export function useCanAct(permission: AccessPermission, module?: AccessModule) {
  const access = usePresentationAccess();
  return Boolean(module ? access?.modules[module][permission] : access?.current[permission]);
}
export function PermissionGate({ permission, module, recordId, allowed, form, anyModule, fallback = null, children }: {
  permission: AccessPermission | AccessPermission[]; module?: AccessModule; recordId?: string; allowed?: boolean; form?: boolean; anyModule?: boolean; fallback?: ReactNode; children?: ReactNode;
}) {
  const access = usePresentationAccess();
  const set = module ? access?.modules[module] : access?.current;
  const required = Array.isArray(permission) ? permission : [permission];
  const permitted = allowed ?? ((anyModule ? Object.values(access?.modules ?? {}).some(cap => required.every(p => cap[p])) : required.every(p => Boolean(set?.[p]))) && (!recordId || Boolean(access?.related[recordId])));
  return permitted && (!form || access?.editForm) ? children : fallback;
}
