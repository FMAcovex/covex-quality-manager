import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { persistenceFormError } from "@/lib/forms/persistence-error";

describe("persistenceFormError", () => {
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
});
