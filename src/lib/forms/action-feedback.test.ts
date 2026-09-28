import { describe, expect, it } from "vitest";
import { userFacingActionError } from "./action-feedback";

describe("userFacingActionError", () => {
  it("keeps a business validation message", () => {
    expect(
      userFacingActionError(
        new Error("Si la CAPA permanece abierta, debe indicarse próxima fecha."),
        "Error",
      ),
    ).toContain("próxima fecha");
  });

  it("hides technical database details", () => {
    expect(
      userFacingActionError(
        new Error("PrismaClientKnownRequestError: Unique constraint failed in database"),
        "No se ha podido guardar.",
      ),
    ).toBe("No se ha podido guardar.");
  });
});
