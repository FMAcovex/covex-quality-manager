import { describe, expect, it } from "vitest";
import { parseDeviationForm } from "@/modules/deviations/validation";
import { parseCapaForm } from "@/modules/capa/validation";

describe("Hito 10.8C3-A form validation", () => {
  it("maps deviation validation messages to concrete fields", () => {
    const form = new FormData();
    form.set("issueDate", "2099-02-31");
    form.set("eventDateTime", "not-a-date");
    form.set("immediateActionsJson", "[]");
    form.set("capaPlansJson", "[]");

    const parsed = parseDeviationForm(form);
    expect(parsed.fieldIssues.departmentId).toBeDefined();
    expect(parsed.fieldIssues.issueDate).toBeDefined();
    expect(parsed.fieldIssues.eventDateTime).toBeDefined();
    expect(parsed.fieldIssues.whatHappened).toBeDefined();
    expect(parsed.fieldIssues.createdByText).toBeDefined();
  });

  it("maps CAPA validation messages to concrete fields while allowing server-assigned business code", () => {
    const form = new FormData();
    form.set("openedAt", "2099-02-31");
    form.set("plannedActionsJson", "[]");

    const parsed = parseCapaForm(form);
    expect(parsed.fieldIssues.departmentId).toBeDefined();
    expect(parsed.fieldIssues.openedAt).toBeDefined();
    expect(parsed.fieldIssues.createdByText).toBeDefined();
    expect(parsed.fieldIssues.originType).toBeDefined();
    expect(parsed.fieldIssues.defectDescription).toBeDefined();
    expect(parsed.fieldIssues.rootCause).toBeDefined();
    expect(parsed.fieldIssues.plannedActionsJson).toBeDefined();
  });
});
