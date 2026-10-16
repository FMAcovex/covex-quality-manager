"use client";
import { CsrfField } from "@/components/csrf";


import { authenticatedFetch } from "@/lib/auth/client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function SessionControls() {
  const pathname = usePathname(), [name, setName] = useState(""), [demo, setDemo] = useState(false);
  useEffect(() => {
    let alive = true;
    authenticatedFetch("/api/auth/session", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(user => { if (alive) { setName(user?.name ?? ""); setDemo(user?.demo === true); } }).catch(() => { if (alive) setName(""); });
    return () => { alive = false; };
  }, [pathname]);
  return name ? <div className="actor session-controls"><span><strong>{name}</strong><small>{demo ? "Sesión de demostración" : "Sesión corporativa"}</small></span><form action="/auth/logout" method="post"><CsrfField /><button type="submit">Cerrar sesión</button></form></div> : null;
}
