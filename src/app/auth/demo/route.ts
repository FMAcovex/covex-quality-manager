import { startDemoSession } from "@/lib/auth/demo";
import { authConfiguration } from "@/lib/auth/config";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { return await startDemoSession(request); }
  catch (error) {
    // Solo en la demo: el motivo (sin datos de sesión) en el terminal, para poder corregirlo.
    try { if (authConfiguration().demo) console.error(`Demo: no se ha podido abrir la sesión: ${error instanceof Error ? error.message : String(error)}`); } catch { /* Fuera de la demo no se registra nada. */ }
    // Dentro del contenedor la URL de la petición usa 0.0.0.0; se vuelve al origen configurado.
    let origin = new URL(request.url).origin;
    try { origin = authConfiguration().origin; } catch { /* Fuera de la demo basta la URL de la petición. */ }
    return NextResponse.redirect(new URL("/login?error=access", origin), 303);
  }
}
