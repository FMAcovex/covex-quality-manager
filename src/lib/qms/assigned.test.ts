import { describe, expect, it, vi } from "vitest";
import { assignedListWhere, assignedWhere, isAssignedToMe, pendingPntPeriodicReview, pendingPntRevision } from "@/lib/qms/assigned";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
const { sortAssigned } = await import("@/modules/dashboard/assigned-query");

// D-102: «Asignadas a mí» con la misma definición en el panel y en los listados.
const me = "11111111-1111-4111-8111-111111111111";

describe("Filtro «Asignadas a mí»", () => {
  it("solo se aplica con el valor «me»", () => {
    expect(isAssignedToMe("me")).toBe(true);
    expect(isAssignedToMe("")).toBe(false);
    expect(assignedListWhere(undefined, me, assignedWhere.capa)).toBeNull();
    expect(assignedListWhere("otro", me, assignedWhere.capa)).toBeNull();
  });

  it("sin usuario en sesión no devuelve ningún expediente", () => {
    expect(assignedListWhere("me", null, assignedWhere.capa)).toEqual({ id: { in: [] } });
  });

  it("cada módulo filtra por el usuario vinculado y por lo que sigue pendiente", () => {
    expect(assignedWhere.deviation(me)).toEqual({ status: { not: "CLOSED" }, capaPlans: { some: { responsibleUserId: me, proposalStatus: "PROPOSED" } } });
    expect(assignedWhere.capa(me)).toEqual({ status: { in: ["DRAFT", "OPEN"] }, plannedActions: { some: { responsibleUserId: me } } });
    const change = JSON.stringify(assignedWhere.changeControl(me));
    for (const part of ["requestDecisionResponsibleUserId", "followupResponsibleUserId", "COMPLETED", "NOT_APPLICABLE"]) expect(change).toContain(part);
    expect(JSON.stringify(assignedWhere.audit(me))).toContain("PENDING_VERIFICATION");
    expect(JSON.stringify(assignedWhere.complaint(me))).toContain("derivedActions");
  });

  it("PNT (D-118): cada función solo en su fase y la revisión periódica sin otra revisión en curso", () => {
    const today = new Date("2026-10-27T00:00:00Z");
    const where = assignedWhere.pnt(me, today);
    expect(where.administrativeStatus).toEqual({ not: "ANNULLED" });
    expect(pendingPntRevision(me).OR).toEqual([
      { status: "DRAFT", preparationResponsibleUserId: me },
      { status: "IN_REVIEW", reviewResponsibleUserId: me },
      { status: "PENDING_APPROVAL", approvalResponsibleUserId: me },
    ]);
    const periodic = pendingPntPeriodicReview(me, today);
    expect(periodic.periodicReviewResponsibleUserId).toBe(me);
    expect(periodic.revisions.none).toEqual({ status: { in: ["DRAFT", "IN_REVIEW", "PENDING_APPROVAL", "APPROVED_PENDING_EFFECTIVE"] } });
    // Límite exclusivo del día 31: incluye las que vencen dentro de 30 días, como el panel.
    expect(JSON.stringify(periodic.revisions.some)).toContain("2026-11-27T00:00:00.000Z");
    expect(JSON.stringify(periodic.revisions.some)).toContain('"lifecycle":{"is":null}');
  });
});

describe("Orden de las asignadas en el panel", () => {
  const base = { module: "CAPA" as const, label: "Acción", detail: "", href: "/capa/x", state: "PENDING" as const };
  it("primero por fecha prevista y después las que no tienen fecha", () => {
    const sorted = sortAssigned([
      { ...base, key: "c", code: "C", dueDate: null },
      { ...base, key: "b", code: "B", dueDate: new Date("2026-03-01") },
      { ...base, key: "a", code: "A", dueDate: new Date("2026-01-01") },
      { ...base, key: "d", code: "A", dueDate: null },
    ]);
    expect(sorted.map((item) => item.key)).toEqual(["a", "b", "d", "c"]);
  });
});
