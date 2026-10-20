import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { persistenceFormError, requiresAuditReason } from "@/lib/forms/persistence-error";

describe("persistenceFormError", () => {
  it("translates a deferred critical decision failure through the audit wrapper after rollback", () => {
    const error = new Error("WRITE_FAILED", { cause: new Error("commit rejected", { cause: new Error("Reason required for critical operational decision; private database detail") }) });
    expect(requiresAuditReason(error)).toBe(true);
    const result = persistenceFormError(error, "la operación");
    expect(result.fieldIssues?.changeReason).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/private|WRITE_FAILED|commit rejected/);
    expect(requiresAuditReason(new Error("Reason required for unknown condition"))).toBe(false);
    const circular = Object.assign(new Error("other failure"), { cause: null as unknown }); circular.cause = circular;
    expect(requiresAuditReason(circular)).toBe(false);
  });
  it("maps the fixed SQL critical-reason condition without exposing database details", () => {
    const error = new Prisma.PrismaClientUnknownRequestError("Reason required for established critical correction; private diagnostic", { clientVersion: "test" });
    const result = persistenceFormError(error, "la desviación");
    expect(result.fieldIssues?.changeReason).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("private diagnostic");
  });
  it("maps duplicate keys to an inline form error", () => {
    const error = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
      meta: {},
    });
    expect(persistenceFormError(error, "la desviación")).toEqual({
      error: "No se puede guardar la desviación.",
      fieldErrors: ["La codificación ya está utilizada por otro expediente del mismo tipo."],
    });
  });

  it("does not expose internal unexpected errors", () => {
    const result = persistenceFormError(new Error("password=secret"), "la CAPA");
    expect(result.error).toBe("No se ha podido guardar la CAPA.");
    expect(result.fieldErrors?.join(" ")).not.toContain("secret");
  });

  it("la rama genérica registra y muestra la referencia (BE1-B)", () => {
    const write = vi.fn();
    const result = persistenceFormError(new Error("fallo interno dato-secreto"), "la desviación", { write });
    const ref = result.fieldErrors?.[0].match(/Referencia para IT: (E-[0-9a-f]{8})\.$/)?.[1];
    expect(ref).toBeDefined();
    expect(write).toHaveBeenCalledTimes(1);
    const line = write.mock.calls[0][0] as string;
    expect(JSON.parse(line)).toMatchObject({ ref, event: "action.persistence", operation: "la desviación" });
    expect(line).not.toContain("dato-secreto");
  });
  it("las ramas esperadas no registran (BE1-B)", () => {
    const write = vi.fn();
    for (const code of ["P2002", "P2003", "P2025"]) persistenceFormError(new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test", meta: {} }), "la desviación", { write });
    persistenceFormError(new Prisma.PrismaClientValidationError("x", { clientVersion: "test" }), "la desviación", { write });
    persistenceFormError(new Error("Reason required for critical operational decision"), "la desviación", { write });
    expect(write).not.toHaveBeenCalled();
  });
});
