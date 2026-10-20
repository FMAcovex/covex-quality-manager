import { describe, expect, it } from "vitest";
import { withJitDisabled } from "@/lib/db-url";

describe("JIT desactivado en la conexión de la aplicación (BE1-C)", () => {
  it("añade jit=off a una URL sin parámetros", () => {
    expect(new URL(withJitDisabled("postgresql://u:p@h:5432/db")).searchParams.get("options")).toBe("-c jit=off");
  });
  it("conserva otros parámetros", () => {
    const url = new URL(withJitDisabled("postgresql://u:p@h:5432/db?sslmode=require&connection_limit=5"));
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("connection_limit")).toBe("5");
    expect(url.searchParams.get("options")).toBe("-c jit=off");
  });
  it("respeta options existente", () => {
    const original = "postgresql://u:p@h:5432/db?options=-c%20statement_timeout%3D5000";
    expect(withJitDisabled(original)).toBe(original);
  });
  it("URL no válida se devuelve igual", () => {
    expect(withJitDisabled("no-es-url")).toBe("no-es-url");
  });
});
