import { describe, expect, it } from "vitest";
import { canReturnToDraft, requestedWorkflowStatus } from "@/lib/forms/draft-workflow";

describe("draft workflow", () => {
  it("resuelve las acciones Guardar borrador y Abrir", () => {
    const draft = new FormData();
    draft.set("saveIntent", "draft");
    expect(requestedWorkflowStatus(draft, "OPEN")).toBe("DRAFT");

    const open = new FormData();
    open.set("saveIntent", "open");
    expect(requestedWorkflowStatus(open, "DRAFT")).toBe("OPEN");
  });

  it("mantiene el estado cuando no hay una acción explícita", () => {
    expect(requestedWorkflowStatus(new FormData(), "CLOSED")).toBe("CLOSED");
  });

  it("solo permite volver a guardar como borrador si ya era borrador", () => {
    expect(canReturnToDraft("DRAFT")).toBe(true);
    expect(canReturnToDraft("OPEN")).toBe(false);
    expect(canReturnToDraft("CLOSED")).toBe(false);
  });
});
