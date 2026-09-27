import { describe, expect, it } from "vitest";
import {
  canonicalizeRelation,
  inverseRelationLabel,
} from "@/lib/qms/relations";

describe("canonicalizeRelation", () => {
  it("preserves direction for directional relations", () => {
    expect(canonicalizeRelation("dev-1", "capa-1", "GENERATES")).toEqual({
      sourceRecordId: "dev-1",
      targetRecordId: "capa-1",
      relationType: "GENERATES",
    });
  });

  it("normalizes symmetric relations", () => {
    expect(canonicalizeRelation("z-record", "a-record", "RELATED_TO")).toEqual({
      sourceRecordId: "a-record",
      targetRecordId: "z-record",
      relationType: "RELATED_TO",
    });
  });

  it("rejects self-relations", () => {
    expect(() =>
      canonicalizeRelation("same", "same", "ASSOCIATED_WITH"),
    ).toThrow("cannot be related to itself");
  });
});

describe("inverseRelationLabel", () => {
  it("derives the inverse without storing a duplicate row", () => {
    expect(inverseRelationLabel("GENERATES")).toBe("ORIGINATES_FROM");
    expect(inverseRelationLabel("RELATED_TO")).toBe("RELATED_TO");
  });
});
