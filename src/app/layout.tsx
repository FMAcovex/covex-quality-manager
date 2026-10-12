import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CsrfProvider } from "@/components/csrf";
import { cookies } from "next/headers";
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
  return (
    <html lang="es">
      <body>
        <CsrfProvider token={csrf}><AppShell>{children}</AppShell></CsrfProvider>
      </body>
    </html>
  );
}
