import { describe, expect, it } from "vitest";
import { finishTour, serverSafeDay, tourEnvironment, waitForSaved } from "./lib";

const test = { APP_ENV: "test", AUTH_SYNTHETIC_IDENTITY: "1", DATABASE_URL: "postgresql://u:p@localhost:5432/covex_phase4b1_test_x" };
const demo = { APP_ENV: "demo", AUTH_PROVIDER: "demo", AUTH_ORIGIN: "http://localhost:3000", DATABASE_URL: "postgresql://u:p@localhost:5432/covex_demo" };

describe("tourEnvironment", () => {
  it("solo admite la base aislada de pruebas o la demo local", () => {
    expect(tourEnvironment(test)).toBe("test");
    expect(tourEnvironment(demo)).toBe("demo");
    for (const env of [
      {},
      { ...test, DATABASE_URL: "postgresql://u:p@db.example.com:5432/covex_phase4b1_test_x" },
      { ...test, DATABASE_URL: "postgresql://u:p@localhost:5432/covex_quality" },
      { ...test, AUTH_SYNTHETIC_IDENTITY: "0" },
      { ...demo, DATABASE_URL: "postgresql://u:p@localhost:5432/covex_quality" },
      { ...demo, APP_ENV: "production" },
    ]) expect(() => tourEnvironment(env)).toThrow(/solo se ejecutan/);
  });
});

describe("finishTour", () => {
  it("con un paso fallido, relanza ese error aunque el cierre y la limpieza también fallen", async () => {
    const step = new Error("Recorrido «X», paso 5: falta la fecha");
    const ran: string[] = [];
    const error = await finishTour(step, [
      async () => { ran.push("close"); throw new Error("Errores de JavaScript en la página"); },
      async () => { ran.push("cleanup"); throw new Error("Foreign key constraint"); },
      async () => { ran.push("disconnect"); },
    ]).then(() => new Error("no falló"), (e: unknown) => e as Error);
    expect(ran).toEqual(["close", "cleanup", "disconnect"]);
    expect(error.message).toMatch(/^Recorrido «X», paso 5: falta la fecha/);
    expect(error.message).toContain("Errores de JavaScript en la página");
    expect(error.message).toContain("Foreign key constraint");
  });

  it("sin paso fallido, el primer error del cierre hace fallar el recorrido", async () => {
    await expect(finishTour(null, [async () => { throw new Error("Errores de JavaScript"); }, async () => undefined])).rejects.toThrow("Errores de JavaScript");
    await expect(finishTour(null, [async () => undefined])).resolves.toBeUndefined();
  });
});

describe("waitForSaved", () => {
  it("devuelve lo guardado en cuanto aparece", async () => {
    let calls = 0;
    await expect(waitForSaved(async () => (++calls >= 3 ? "guardado" : null), "el seguimiento", { intervalMs: 1 })).resolves.toBe("guardado");
  });

  it("si la pantalla muestra un error del servidor, falla enseguida con ese mensaje", async () => {
    const started = Date.now();
    await expect(waitForSaved(async () => null, "el seguimiento 01", { intervalMs: 1, timeoutMs: 5000, screenError: async () => "No se puede marcar Ejecutado mientras existan acciones pendientes." }))
      .rejects.toThrow("No se ha guardado el seguimiento 01: No se puede marcar Ejecutado mientras existan acciones pendientes.");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("sin error en pantalla, agota el tiempo y dice qué no se guardó", async () => {
    await expect(waitForSaved(async () => null, "el cierre", { intervalMs: 1, timeoutMs: 20 })).rejects.toThrow("No se ha guardado el cierre.");
  });
});

describe("serverSafeDay", () => {
  it("de noche, cuando Madrid ya está en el día siguiente, usa la fecha UTC del servidor", () => {
    expect(serverSafeDay(new Date("2026-11-13T23:30:00Z"))).toBe("2026-11-13");
    expect(serverSafeDay(new Date("2026-07-13T22:15:00Z"))).toBe("2026-07-13");
  });
  it("de día, Madrid y UTC coinciden", () => {
    expect(serverSafeDay(new Date("2026-11-13T10:00:00Z"))).toBe("2026-11-13");
  });
  it("de madrugada en UTC (antes de la medianoche de Madrid no ocurre): devuelve la menor de las dos", () => {
    expect(serverSafeDay(new Date("2026-12-31T23:59:00Z"))).toBe("2026-12-31");
  });
});
