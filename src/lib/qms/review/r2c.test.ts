import { describe, expect, it } from "vitest";
import { aggregateActiveReviewCounts, reviewListWhere, reviewFilterOptions } from "./list-domain";
import { isAllowedReviewTarget } from "./target-validation";
import { changeControlReviewTargets, changeControlTaskReviewTarget, changeControlFollowupReviewTarget } from "./targets/change-control";
import { reviewTargetWithValue } from "./targets/catalog";
import { reviewVersionLabel, reviewTargetHref } from "./ui-model";

describe("R2C transversal", () => {
  it("mantiene 31 objetivos únicos, con ocho filas lógicas 2.a", () => {
    const targets = Object.values(changeControlReviewTargets);
    expect(targets).toHaveLength(31);
    expect(new Set(targets.map((target) => target.anchorId)).size).toBe(31);
    expect(targets.filter((target) => target.targetKind === "SECTION")).toHaveLength(8);
    for (const target of targets) {
      const input = { ...reviewTargetWithValue(target, "valor"), qmsRecordId: "record", initialMessage: "Mensaje" };
      expect(isAllowedReviewTarget("CHANGE_CONTROL", input)).toBe(true);
      expect(isAllowedReviewTarget("CAPA", input)).toBe(false);
      expect(isAllowedReviewTarget("CHANGE_CONTROL", { ...input, fieldPath: "inventado" })).toBe(false);
      expect(isAllowedReviewTarget("CHANGE_CONTROL", { ...input, targetEntityId: "intruso" })).toBe(false);
    }
  });
  it("identifica dinámicos por UUID, nunca por índice o texto", () => {
    const task = changeControlTaskReviewTarget("uuid-persistente", "texto original");
    expect(changeControlTaskReviewTarget("uuid-persistente", "texto cambiado").anchorId).toBe(task.anchorId);
    expect(task.targetEntityType).toBe("ChangeControlTask");
    expect(changeControlFollowupReviewTarget("followup-uuid", null, 0).label).toBe("Seguimiento 00 · Apertura");
    expect(reviewTargetHref("/changes/id", task, "thread")).toContain("tab=dictamen&review=1&thread=thread#review-change-control-task-uuid-persistente");
    expect(reviewVersionLabel(0, "FOLLOWUP")).toBe("Seguimiento 00 · Apertura");
  });
  it("solo cuenta pendientes y aceptadas, independientemente del control de datos", () => {
    const counts = aggregateActiveReviewCounts([
      { qmsRecordId: "a", status: "PENDING", _count: { _all: 2 } },
      { qmsRecordId: "a", status: "ACCEPTED", _count: { _all: 3 } },
      { qmsRecordId: "a", status: "RESOLVED", _count: { _all: 99 } },
      { qmsRecordId: "b", status: "RESOLVED", _count: { _all: 1 } },
    ]);
    expect(counts.get("a")).toEqual({ pending: 2, accepted: 3 });
    expect(counts.has("b")).toBe(false);
  });
  it("comparte los cinco filtros y aplica NONE como ausencia de activos", () => {
    expect(reviewFilterOptions.map((option) => option.value)).toEqual(["", "PENDING", "ACCEPTED", "ACTIVE", "NONE"]);
    expect(reviewListWhere("PENDING")).toEqual({ reviewThreads: { some: { status: "PENDING" } } });
    expect(reviewListWhere("ACCEPTED")).toEqual({ reviewThreads: { some: { status: "ACCEPTED" } } });
    expect(reviewListWhere("ACTIVE")).toEqual({ reviewThreads: { some: { status: { in: ["PENDING", "ACCEPTED"] } } } });
    expect(reviewListWhere("NONE")).toEqual({ reviewThreads: { none: { status: { in: ["PENDING", "ACCEPTED"] } } } });
    expect(reviewListWhere("manipulado")).toBeNull();
  });
});
