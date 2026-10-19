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

  describe("en GitHub Codespaces (D-108)", () => {
    const codespace = { CODESPACES: "true", CODESPACE_NAME: "fmacovex-demo-x7q9", GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev" };
    const origin = "https://fmacovex-demo-x7q9-3000.app.github.dev";
    it("admite la dirección del propio Codespace y, como origen de la petición, su loopback", () => {
      expect(localDemoEnvironment({ ...demo, ...codespace, AUTH_ORIGIN: origin })).toBe(true);
      expect(authConfiguration({ ...demo, ...codespace, AUTH_ORIGIN: origin })).toMatchObject({ demo: true, origin, secure: false, requestOrigins: [origin, "http://localhost:3000", "http://127.0.0.1:3000"] });
    });

    it("fuera del Codespace solo se admite el origen configurado", () => {
      expect(authConfiguration(demo).requestOrigins).toEqual(["http://localhost:3000"]);
    });
    it.each([
      ["fuera de un Codespace", { CODESPACES: undefined }],
      ["otro Codespace", { AUTH_ORIGIN: "https://otro-codespace-3000.app.github.dev" }],
      ["otro dominio", { AUTH_ORIGIN: "https://fmacovex-demo-x7q9-3000.app.github.dev.example.com" }],
      ["subdominio añadido", { AUTH_ORIGIN: "https://x.fmacovex-demo-x7q9-3000.app.github.dev" }],
      ["http", { AUTH_ORIGIN: "http://fmacovex-demo-x7q9-3000.app.github.dev" }],
      ["con ruta", { AUTH_ORIGIN: origin + "/app" }],
      ["otra base de datos", { DATABASE_URL: "postgresql://covex:x@localhost:5432/covex_quality" }],
      ["producción", { APP_ENV: "production" }],
    ])("no se habilita %s", (_case, change) => {
      expect(localDemoEnvironment({ ...demo, ...codespace, AUTH_ORIGIN: origin, ...change })).toBe(false);
    });
  });

  it("Entra sigue exigiendo HTTPS y no se confunde con la demo", () => {
    expect(() => authConfiguration({ APP_ENV: "demo", AUTH_PROVIDER: "entra", AUTH_ORIGIN: "http://localhost:3000" })).toThrow();
  });
});
