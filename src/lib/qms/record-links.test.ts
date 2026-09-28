import { describe, expect, it } from "vitest";
import {
  collectRelatedRecords,
  qmsRecordHref,
  qmsRecordTypeLabel,
} from "./record-links";

describe("QMS record links", () => {
  it("routes every V1 record type to its detail page", () => {
    expect(qmsRecordHref({ id: "d", recordType: "DEVIATION", businessCode: "D/1" })).toBe("/deviations/d");
    expect(qmsRecordHref({ id: "c", recordType: "CAPA", businessCode: "AC/1" })).toBe("/capa/c");
    expect(qmsRecordHref({ id: "cc", recordType: "CHANGE_CONTROL", businessCode: "CC/1" })).toBe("/changes/cc");
    expect(qmsRecordHref({ id: "r", recordType: "COMPLAINT", businessCode: "R/1" })).toBe("/complaints/r");
    expect(qmsRecordHref({ id: "dv", recordType: "RETURN", businessCode: "DEV/1" })).toBe("/returns/dv");
  });

  it("collects incoming and outgoing relations once", () => {
    const shared = { id: "shared", recordType: "CAPA", businessCode: "AC/1" };
    const records = collectRelatedRecords({
      sourceRelations: [{ targetRecord: shared }],
      targetRelations: [
        { sourceRecord: shared },
        { sourceRecord: { id: "other", recordType: "COMPLAINT", businessCode: "R/1" } },
      ],
    });
    expect(records.map((record) => record.id)).toEqual(["shared", "other"]);
    expect(qmsRecordTypeLabel("COMPLAINT")).toBe("Reclamación");
  });
});
