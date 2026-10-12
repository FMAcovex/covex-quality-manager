import { AccessError } from "./context";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isolatedTestEnvironment(env: Record<string, string | undefined> = process.env) {
  if (env.APP_ENV !== "test" || env.AUTH_SYNTHETIC_IDENTITY !== "1") return false;
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false;
    return url.pathname.startsWith("/covex_phase4b1_test_") || (url.pathname === "/covex_quality" && env.CI === "true" && env.GITHUB_ACTIONS === "true");
  } catch { return false; }
}
export function authConfiguration(env: Record<string, string | undefined> = process.env) {
  const synthetic = env.AUTH_PROVIDER === "synthetic";
  if (synthetic && !isolatedTestEnvironment(env)) throw new AccessError(403, "La identidad de pruebas no está habilitada en este entorno.");
  if (!synthetic && env.AUTH_PROVIDER !== "entra") throw new AccessError(403, "La identidad corporativa no está configurada.");
  const origin = new URL(env.AUTH_ORIGIN ?? "https://invalid.invalid");
  const tenantId = (env.AUTH_ENTRA_TENANT_ID ?? "").toLowerCase(), clientId = (env.AUTH_ENTRA_CLIENT_ID ?? "").toLowerCase(), secret = env.AUTH_ENTRA_CLIENT_SECRET ?? "";
  if (!uuid.test(tenantId) || !uuid.test(clientId) || secret.length < 16 || !env.AUTH_ORIGIN || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
    throw new AccessError(403, "Configuración corporativa incompleta.");
  if (!synthetic && (origin.protocol !== "https:" || env.AUTH_SYNTHETIC_IDENTITY === "1")) throw new AccessError(403, "La configuración corporativa requiere HTTPS y excluye identidad sintética.");
  const issuer = synthetic ? new URL(env.AUTH_TEST_ISSUER ?? "https://invalid.invalid") : new URL(`https://login.microsoftonline.com/${tenantId}/v2.0`);
  if (synthetic && (issuer.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(issuer.hostname) || origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname)))
    throw new AccessError(403, "El proveedor de pruebas debe permanecer en loopback.");
  return { synthetic, origin: origin.origin, issuer, tenantId, clientId, secret, secure: !synthetic, ttlMs: 8 * 60 * 60 * 1000, idleMs: 30 * 60 * 1000 };
}
export function safeReturnTo(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value) && !value.startsWith("/auth/") ? value : "/";
}
