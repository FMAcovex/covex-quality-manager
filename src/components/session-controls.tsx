"use client";
import { CsrfField } from "@/components/csrf";


import { authenticatedFetch } from "@/lib/auth/client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function SessionControls() {
  const pathname = usePathname(), [name, setName] = useState("");
  useEffect(() => {
    let alive = true;
    authenticatedFetch("/api/auth/session", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(user => { if (alive) setName(user?.name ?? ""); }).catch(() => { if (alive) setName(""); });
    return () => { alive = false; };
  }, [pathname]);
  return name ? <div className="actor session-controls"><span><strong>{name}</strong><small>Sesión corporativa</small></span><form action="/auth/logout" method="post"><CsrfField /><button type="submit">Cerrar sesión</button></form></div> : null;
}
