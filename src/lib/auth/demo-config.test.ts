import { describe, expect, it } from "vitest";
import { authConfiguration, demoTenant, localDemoEnvironment } from "./config";

const demo = { APP_ENV: "demo", AUTH_PROVIDER: "demo", DATABASE_URL: "postgresql://covex:covex_demo@postgres:5432/covex_demo", AUTH_ORIGIN: "http://localhost:3000" };

describe("Demo local (D-087)", () => {
  it("se habilita solo con APP_ENV=demo, base covex_demo y origen http en localhost", () => {
    expect(localDemoEnvironment(demo)).toBe(true);
    expect(localDemoEnvironment({ ...demo, AUTH_ORIGIN: "http://127.0.0.1:3000" })).toBe(true);
  });

  it.each([
    ["producción", { APP_ENV: "production" }],
    ["entorno de pruebas", { APP_ENV: "test" }],
    ["otro proveedor", { AUTH_PROVIDER: "entra" }],
    ["otra base de datos", { DATABASE_URL: "postgresql://covex:x@db:5432/covex_quality" }],
    ["origen https", { AUTH_ORIGIN: "https://localhost:3000" }],
    ["origen publicado", { AUTH_ORIGIN: "http://calidad.covex.local" }],
    ["origen con ruta", { AUTH_ORIGIN: "http://localhost:3000/app" }],
    ["identidad sintética de pruebas", { AUTH_SYNTHETIC_IDENTITY: "1" }],
  ])("no se habilita con %s", (_case, change) => {
    const env = { ...demo, ...change };
    expect(localDemoEnvironment(env)).toBe(false);
    if (env.AUTH_PROVIDER === "demo") expect(() => authConfiguration(env)).toThrow(/demo local no está habilitada/);
  });

  it("usa cookies sin __Host-, tenant ficticio y ningún proveedor de identidad", () => {
    const config = authConfiguration(demo);
    expect(config).toMatchObject({ demo: true, synthetic: false, secure: false, tenantId: demoTenant, origin: "http://localhost:3000" });
  });

  it("Entra sigue exigiendo HTTPS y no se confunde con la demo", () => {
    expect(() => authConfiguration({ APP_ENV: "demo", AUTH_PROVIDER: "entra", AUTH_ORIGIN: "http://localhost:3000" })).toThrow();
  });
});
