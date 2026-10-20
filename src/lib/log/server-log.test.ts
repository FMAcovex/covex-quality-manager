import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { logServerError, newErrorReference, serverErrorLine } from "@/lib/log/server-log";

const at = new Date("2026-10-20T10:00:00Z");
const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;

describe("registro de errores del servidor (BE1-B)", () => {
  it("serverErrorLine produce los campos fijos", () => {
    const line = parse(serverErrorLine("action.persistence", new TypeError("boom con dato-secreto-123"), {
      ref: "E-0000abcd", operation: "saveDeviation", module: "DEVIATION", userId: "11111111-1111-1111-1111-111111111111", at,
    }));
    expect(line).toMatchObject({
      service: "covex-quality-manager", event: "action.persistence", level: "error", at: "2026-10-20T10:00:00.000Z",
      ref: "E-0000abcd", operation: "saveDeviation", module: "DEVIATION", userId: "11111111-1111-1111-1111-111111111111", errorName: "TypeError",
    });
    expect(Array.isArray(line.frames)).toBe(true);
  });

  it("no escribe el mensaje, cause ni meta", () => {
    const withCause = new Error("fallo dato-secreto-123", { cause: new Error("causa dato-secreto-123") });
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique dato-secreto-123", { code: "P2002", clientVersion: "test", meta: { target: ["dato-secreto-123"], modelName: "Deviation" } });
    for (const error of [withCause, prismaError]) expect(serverErrorLine("x", error, { ref: "E-00000000", at })).not.toContain("dato-secreto-123");
    expect(parse(serverErrorLine("x", prismaError, { ref: "E-00000000", at }))).toMatchObject({ prismaCode: "P2002", prismaModel: "Deviation" });
  });

  it("PrismaClientValidationError no filtra argumentos", () => {
    const error = new Prisma.PrismaClientValidationError("Argument whatHappened: dato-secreto-123", { clientVersion: "test" });
    expect(serverErrorLine("x", error, { ref: "E-00000000", at })).not.toContain("dato-secreto-123");
  });

  it("recorta a 10 frames sin la línea del mensaje", () => {
    const error = new Error("mensaje dato-secreto-123");
    error.stack = ["Error: mensaje dato-secreto-123", ...Array.from({ length: 15 }, (_, i) => `    at f${i} (x.ts:1:1)`)].join("\n");
    const frames = parse(serverErrorLine("x", error, { ref: "E-00000000", at })).frames as string[];
    expect(frames).toHaveLength(10);
    expect(frames[0]).toBe("at f0 (x.ts:1:1)");
    expect(frames.join("\n")).not.toContain("dato-secreto-123");
  });

  it("acepta valores que no son Error", () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    const cases: [unknown, string][] = [["texto", "string"], [null, "null"], [undefined, "undefined"], [{}, "Object"], [circular, "Object"]];
    for (const [value, name] of cases) {
      const line = parse(serverErrorLine("x", value, { ref: "E-00000000", at }));
      expect(line.errorName).toBe(name);
      expect(line.frames).toEqual([]);
    }
  });

  it("newErrorReference sigue el formato", () => {
    for (let i = 0; i < 50; i++) expect(newErrorReference()).toMatch(/^E-[0-9a-f]{8}$/);
  });

  it("logServerError devuelve la ref y escribe una línea", () => {
    const write = vi.fn();
    expect(logServerError("x", new Error("e"), { ref: "abc123" }, write)).toBe("abc123");
    expect(write).toHaveBeenCalledTimes(1);
    expect(parse(write.mock.calls[0][0]).ref).toBe("abc123");
    const generated = logServerError("x", new Error("e"), {}, write);
    expect(generated).toMatch(/^E-[0-9a-f]{8}$/);
    expect(parse(write.mock.calls[1][0]).ref).toBe(generated);
    expect(write.mock.calls[1][0]).not.toContain("\n");
  });

  it("logServerError no lanza si write falla", () => {
    const write = () => { throw new Error("stdout cerrado"); };
    expect(logServerError("x", new Error("e"), { ref: "E-12345678" }, write)).toBe("E-12345678");
  });

  it("un mensaje de varias líneas no se cuela en frames (revisión BE1-B)", () => {
    const error = new Error("primera\n    at dato-secreto (juan@example.invalid)\nfinal");
    error.stack = "Error: primera\n    at dato-secreto (juan@example.invalid)\nfinal\n    at real (/app/x.js:1:2)";
    const line = serverErrorLine("x", error, { ref: "E-00000000", at });
    expect(line).not.toContain("dato-secreto");
    expect(parse(line).frames).toEqual(["at real (/app/x.js:1:2)"]);
  });

  it("errorName usa error.name aunque la clase esté minimizada (revisión BE1-B)", () => {
    const j = class extends Error { constructor() { super("m"); this.name = "SavedViewError"; } };
    expect(parse(serverErrorLine("x", new j(), { ref: "E-00000000", at })).errorName).toBe("SavedViewError");
    const odd = Object.assign(new Error("m"), { name: "nombre con dato-secreto y espacios" });
    expect(serverErrorLine("x", odd, { ref: "E-00000000", at })).not.toContain("dato-secreto");
  });
});

