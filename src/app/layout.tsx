import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CsrfProvider } from "@/components/csrf";
import { cookies } from "next/headers";
import { PermissionProvider } from "@/components/permissions";
import { requireUser } from "@/lib/auth/session";
import { presentationAccess } from "@/lib/auth/presentation";
import { AccessError } from "@/lib/auth/context";
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
  const shell = <AppShell>{children}</AppShell>;
  return (
    <html lang="es">
      <body>
        <CsrfProvider token={csrf}>{access ? <PermissionProvider value={access}>{shell}</PermissionProvider> : shell}</CsrfProvider>
      </body>
    </html>
  );
}
