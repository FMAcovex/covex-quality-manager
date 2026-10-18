import { beforeEach, describe, expect, it, vi } from "vitest";
import { optionalUserId, responsibleTextAfterPick, rowUserIdSchema } from "@/lib/qms/responsible-user";

const count = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { authUser: { count: (...args: unknown[]) => count(...args) } } }));
const { inactiveResponsibleUserMessage, responsibleUsersProblem } = await import("@/lib/auth/app-users");

// D-101: usuario de la aplicación opcional junto al responsable en texto libre.
const ana = "11111111-1111-4111-8111-111111111111";
const luis = "22222222-2222-4222-8222-222222222222";

describe("Valor del usuario responsable", () => {
  it("vacío es «sin usuario» y un valor que no es UUID no se acepta", () => {
    expect(optionalUserId("")).toBeNull();
    expect(optionalUserId(undefined)).toBeNull();
    expect(optionalUserId(` ${ana} `)).toBe(ana);
    expect(optionalUserId("otro")).toBeUndefined();
  });

  it("en una fila, un valor no válido no descarta la fila: queda sin usuario", () => {
    expect(rowUserIdSchema.parse(ana)).toBe(ana);
    expect(rowUserIdSchema.parse("otro")).toBeNull();
    expect(rowUserIdSchema.parse(42)).toBeNull();
    expect(rowUserIdSchema.parse(undefined)).toBeNull();
  });

  it("al elegir un usuario solo se propone su nombre si el responsable está vacío", () => {
    const user = { id: ana, name: "Ana Pérez", active: true };
    expect(responsibleTextAfterPick("", user)).toBe("Ana Pérez");
    expect(responsibleTextAfterPick("Jefe de Producción", user)).toBe("Jefe de Producción");
    expect(responsibleTextAfterPick("", undefined)).toBe("");
  });
});

describe("Comprobación al guardar", () => {
  beforeEach(() => count.mockReset());

  it("sin usuarios nuevos no consulta nada", async () => {
    expect(await responsibleUsersProblem([null, undefined])).toBeNull();
    expect(await responsibleUsersProblem([ana], [ana])).toBeNull();
    expect(count).not.toHaveBeenCalled();
  });

  it("los usuarios nuevos deben estar activos y autorizados", async () => {
    count.mockResolvedValue(2);
    expect(await responsibleUsersProblem([ana, luis, ana])).toBeNull();
    expect(count).toHaveBeenCalledWith({ where: { id: { in: [ana, luis] }, active: true, authorizedAt: { not: null } } });
    count.mockResolvedValue(1);
    expect(await responsibleUsersProblem([ana, luis])).toBe(inactiveResponsibleUserMessage);
  });

  it("un usuario ya asignado se conserva aunque ahora esté inactivo", async () => {
    count.mockResolvedValue(1);
    expect(await responsibleUsersProblem([ana, luis], [ana])).toBeNull();
    expect(count).toHaveBeenCalledWith({ where: { id: { in: [luis] }, active: true, authorizedAt: { not: null } } });
  });
});
