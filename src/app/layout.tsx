import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageLoading } from "@/components/page-loading";
import { CsrfProvider } from "@/components/csrf";
import { cookies } from "next/headers";
import { PermissionProvider } from "@/components/permissions";
import { requireUser } from "@/lib/auth/session";
import { presentationAccess } from "@/lib/auth/presentation";
import { AccessError } from "@/lib/auth/context";
import { appVersion } from "@/lib/release/version";
// D-117 (H-02): Inter incluida en la aplicación (licencia OFL), sin depender de Internet ni de las fuentes del equipo.
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "COVEX Quality Manager",
  description: "Gestión interna del Sistema de Calidad de COVEX",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const csrf = jar.get("__Host-covex-csrf")?.value ?? jar.get("covex-csrf")?.value ?? "";
  let access = null;
  try { if (jar.has("__Host-covex-session") || jar.has("covex-session")) access = presentationAccess(await requireUser(), "SYSTEM"); }
  catch (error) { if (!(error instanceof AccessError)) throw error; }
  // La versión solo se enseña con sesión iniciada (como el menú, D-117).
  const shell = <AppShell version={access ? appVersion : undefined}><Suspense fallback={<PageLoading />}>{children}</Suspense></AppShell>;
  return (
    <html lang="es">
      <body>
        <CsrfProvider token={csrf}>{access ? <PermissionProvider value={access}>{shell}</PermissionProvider> : shell}</CsrfProvider>
      </body>
    </html>
  );
}
