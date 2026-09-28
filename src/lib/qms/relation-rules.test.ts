import { describe, expect, it } from "vitest";
import { QmsRecordType } from "@prisma/client";
import {
  allowedOperationalRelationTypes,
  canonicalOperationalRelation,
  selectOperationalRelationTarget,
} from "@/lib/qms/relation-rules";

const rec = (id: string, recordType: QmsRecordType, businessCode: string) => ({
  id,
  recordType,
  businessCode,
});

describe("Hito 10.8C3-B1 operational relation rules", () => {
  it("allows Deviation -> CAPA", () => {
    const relation = canonicalOperationalRelation(
      rec("d1", QmsRecordType.DEVIATION, "D/1"),
      rec("c1", QmsRecordType.CAPA, "AC/1"),
    );
    expect(relation).toMatchObject({
      sourceRecordId: "d1",
      targetRecordId: "c1",
      relationType: "GENERATES",
    });
  });

  it("normalizes CAPA -> Deviation to Deviation -> CAPA", () => {
    const relation = canonicalOperationalRelation(
      rec("c1", QmsRecordType.CAPA, "AC/1"),
      rec("d1", QmsRecordType.DEVIATION, "D/1"),
    );
    expect(relation).toMatchObject({
      sourceRecordId: "d1",
      targetRecordId: "c1",
      relationType: "GENERATES",
    });
  });

  it("allows Complaint -> CAPA and inverse lookup", () => {
    expect(
      canonicalOperationalRelation(
        rec("r1", QmsRecordType.COMPLAINT, "R/1"),
        rec("c1", QmsRecordType.CAPA, "AC/1"),
      ),
    ).toMatchObject({ sourceRecordId: "r1", targetRecordId: "c1" });

    expect(
      canonicalOperationalRelation(
        rec("c1", QmsRecordType.CAPA, "AC/1"),
        rec("r1", QmsRecordType.COMPLAINT, "R/1"),
      ),
    ).toMatchObject({ sourceRecordId: "r1", targetRecordId: "c1" });
  });

  it("allows Complaint -> Return and inverse lookup", () => {
    expect(
      canonicalOperationalRelation(
        rec("r1", QmsRecordType.COMPLAINT, "R/1"),
        rec("v1", QmsRecordType.RETURN, "DEV/1"),
      ),
    ).toMatchObject({ sourceRecordId: "r1", targetRecordId: "v1" });

    expect(
      canonicalOperationalRelation(
        rec("v1", QmsRecordType.RETURN, "DEV/1"),
        rec("r1", QmsRecordType.COMPLAINT, "R/1"),
      ),
    ).toMatchObject({ sourceRecordId: "r1", targetRecordId: "v1" });
  });

  it("rejects invalid operational combinations", () => {
    expect(() =>
      canonicalOperationalRelation(
        rec("d1", QmsRecordType.DEVIATION, "D/1"),
        rec("r1", QmsRecordType.COMPLAINT, "R/1"),
      ),
    ).toThrow();

    expect(() =>
      canonicalOperationalRelation(
        rec("c1", QmsRecordType.CAPA, "AC/1"),
        rec("v1", QmsRecordType.RETURN, "DEV/1"),
      ),
    ).toThrow();

    expect(allowedOperationalRelationTypes(QmsRecordType.CHANGE_CONTROL)).toEqual([]);
  });

  it("rejects ambiguous code resolution", () => {
    expect(() =>
      selectOperationalRelationTarget(QmsRecordType.COMPLAINT, [
        rec("c1", QmsRecordType.CAPA, "X/1"),
        rec("v1", QmsRecordType.RETURN, "X/1"),
      ]),
    ).toThrow(/más de un tipo/);
  });

  it("ignores non-compatible records when resolving a code", () => {
    const target = selectOperationalRelationTarget(QmsRecordType.DEVIATION, [
      rec("r1", QmsRecordType.COMPLAINT, "AC/1"),
      rec("c1", QmsRecordType.CAPA, "AC/1"),
    ]);
    expect(target.id).toBe("c1");
  });
});
