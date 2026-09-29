import { describe, expect, it } from "vitest";
import {
  nextCapaFollowupSequence,
  resolveCapaFollowupVersion,
} from "@/modules/capa/followup-version-ui";

describe("Hito 10.8C3-C2: resolución visual seguimiento ↔ versión", () => {
  it("calcula la siguiente secuencia CAPA", () => {
    expect(nextCapaFollowupSequence([])).toBe(1);
    expect(
      nextCapaFollowupSequence([
        { sequenceNumber: 1 },
        { sequenceNumber: 2 },
      ]),
    ).toBe(3);
  });

  it("prioriza sourceEntityId para enlazar un seguimiento con su versión", () => {
    const versions = [
      {
        kind: "FOLLOWUP",
        sourceEntityId: "followup-other",
        sequenceNumber: 1,
        label: "wrong",
      },
      {
        kind: "FOLLOWUP",
        sourceEntityId: "followup-1",
        sequenceNumber: 9,
        label: "exact",
      },
    ];

    expect(
      resolveCapaFollowupVersion(versions, {
        id: "followup-1",
        sequenceNumber: 1,
      })?.label,
    ).toBe("exact");
  });

  it("usa la secuencia como fallback para históricos sin sourceEntityId", () => {
    const versions = [
      {
        kind: "FOLLOWUP",
        sourceEntityId: null,
        sequenceNumber: 2,
        label: "historical",
      },
    ];

    expect(
      resolveCapaFollowupVersion(versions, {
        id: "followup-legacy",
        sequenceNumber: 2,
      })?.label,
    ).toBe("historical");
  });

  it("no enlaza versiones que no sean FOLLOWUP", () => {
    const versions = [
      {
        kind: "INITIAL",
        sourceEntityId: "followup-1",
        sequenceNumber: 1,
      },
    ];

    expect(
      resolveCapaFollowupVersion(versions, {
        id: "followup-1",
        sequenceNumber: 1,
      }),
    ).toBeNull();
  });
});
