import { describe, expect, it } from "vitest";
import {
  preserveFormState,
  submittedDefaults,
  submittedValues,
} from "@/lib/forms/preserved-state";

describe("preserved-state", () => {
  it("serializa campos simples y multivalor", () => {
    const form = new FormData();
    form.set("name", "QA");
    form.append("scope", "A");
    form.append("scope", "B");

    expect(submittedValues(form)).toEqual({
      name: "QA",
      scope: ["A", "B"],
    });
  });

  it("incrementa revisión y conserva los valores enviados", () => {
    const form = new FormData();
    form.set("businessCode", "TEST-001");

    expect(
      preserveFormState(
        { formRevision: 2 },
        form,
        { error: "Error de prueba" },
      ),
    ).toMatchObject({
      error: "Error de prueba",
      formRevision: 3,
      submittedValues: { businessCode: "TEST-001" },
    });
  });

  it("superpone valores enviados a los defaults originales", () => {
    const defaults = { businessCode: "OLD", departmentId: "D1" };
    const resolved = submittedDefaults(defaults, {
      businessCode: "NEW",
    });

    expect(resolved.businessCode).toBe("NEW");
    expect(resolved.departmentId).toBe("D1");
  });
});
