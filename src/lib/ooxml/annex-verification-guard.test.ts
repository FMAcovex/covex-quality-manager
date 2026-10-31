import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertDisposableDatabase, assertOutputOutsideRepository } from "./annex-verification-guard";

describe("verificación de anexos: solo en una base de datos desechable (D-128)", () => {
  it("acepta solo bases de datos cuyo nombre empieza por covex_annexes_verify", () => {
    expect(() => assertDisposableDatabase({ DATABASE_URL: "postgresql://u:p@localhost:5432/covex_annexes_verify?schema=public" })).not.toThrow();
    expect(() => assertDisposableDatabase({ DATABASE_URL: "postgresql://u:p@localhost:5432/covex_annexes_verify_31" })).not.toThrow();
    // Ni la base de trabajo, aunque el entorno sea de pruebas de la CI.
    expect(() => assertDisposableDatabase({ DATABASE_URL: "postgresql://u:p@localhost:5432/covex_quality", APP_ENV: "test", AUTH_SYNTHETIC_IDENTITY: "1", CI: "true", GITHUB_ACTIONS: "true" })).toThrow(/desechable/);
    expect(() => assertDisposableDatabase({})).toThrow(/desechable/);
    expect(() => assertDisposableDatabase({ DATABASE_URL: "no es una url" })).toThrow(/desechable/);
  });

  it("la salida (con copias de las plantillas) no puede quedar en el repositorio salvo en informe-anexos/", () => {
    const root = "/repo";
    expect(() => assertOutputOutsideRepository(path.join(root, "informe-anexos"), root)).not.toThrow();
    expect(() => assertOutputOutsideRepository(path.join(root, "informe-anexos", "2031"), root)).not.toThrow();
    expect(() => assertOutputOutsideRepository("/tmp/informe", root)).not.toThrow();
    expect(() => assertOutputOutsideRepository(path.join(root, "docs"), root)).toThrow(/informe-anexos/);
    expect(() => assertOutputOutsideRepository(root, root)).toThrow(/informe-anexos/);
  });
});
