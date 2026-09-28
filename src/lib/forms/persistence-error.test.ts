import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { persistenceFormError } from "@/lib/forms/persistence-error";

describe("persistenceFormError", () => {
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
});
