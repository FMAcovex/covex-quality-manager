import { describe, expect, it } from "vitest";
import { QmsRecordType, QmsRelationType } from "@prisma/client";
import {
  allowedIncomingRelationTypes,
  allowedOutgoingRelationTypes,
  canRelate,
  canonicalOperationalRelation,
  selectOperationalRelationTarget,
} from "@/lib/qms/relation-rules";

const rec = (id: string, recordType: QmsRecordType, businessCode: string) => ({
  id,
  recordType,
  businessCode,
});

describe("Hito 10.8C3-B1: reglas direccionales QMS", () => {
  it.each([
    [QmsRecordType.DEVIATION, QmsRecordType.CAPA],
    [QmsRecordType.AUDIT, QmsRecordType.DEVIATION],
    [QmsRecordType.AUDIT, QmsRecordType.CAPA],
    [QmsRecordType.COMPLAINT, QmsRecordType.CAPA],
    [QmsRecordType.COMPLAINT, QmsRecordType.RETURN],
    [QmsRecordType.OOS, QmsRecordType.CAPA],
    [QmsRecordType.OOS, QmsRecordType.DEVIATION],
  ])("permite %s -> %s con GENERATES", (sourceType, targetType) => {
    expect(canRelate(sourceType, targetType, QmsRelationType.GENERATES)).toBe(true);
    expect(
      canonicalOperationalRelation(
        rec("source", sourceType, "SOURCE/1"),
        rec("target", targetType, "TARGET/1"),
      ),
    ).toMatchObject({
      sourceRecordId: "source",
      targetRecordId: "target",
      relationType: QmsRelationType.GENERATES,
    });
  });

  it.each([
    [QmsRecordType.CAPA, QmsRecordType.DEVIATION],
    [QmsRecordType.CAPA, QmsRecordType.AUDIT],
    [QmsRecordType.DEVIATION, QmsRecordType.AUDIT],
    [QmsRecordType.AUDIT, QmsRecordType.AUDIT],
    [QmsRecordType.AUDIT, QmsRecordType.COMPLAINT],
    [QmsRecordType.AUDIT, QmsRecordType.RETURN],
    [QmsRecordType.AUDIT, QmsRecordType.CHANGE_CONTROL],
    [QmsRecordType.RETURN, QmsRecordType.CAPA],
    [QmsRecordType.RETURN, QmsRecordType.DEVIATION],
    [QmsRecordType.DEVIATION, QmsRecordType.RETURN],
    [QmsRecordType.CAPA, QmsRecordType.RETURN],
    [QmsRecordType.CHANGE_CONTROL, QmsRecordType.CAPA],
    [QmsRecordType.CAPA, QmsRecordType.OOS],
    [QmsRecordType.DEVIATION, QmsRecordType.OOS],
    [QmsRecordType.OOS, QmsRecordType.CHANGE_CONTROL],
    [QmsRecordType.OOS, QmsRecordType.RETURN],
    [QmsRecordType.OOS, QmsRecordType.OOS],
  ])("bloquea %s -> %s", (sourceType, targetType) => {
    expect(canRelate(sourceType, targetType, QmsRelationType.GENERATES)).toBe(false);
    expect(() =>
      canonicalOperationalRelation(
        rec("source", sourceType, "SOURCE/1"),
        rec("target", targetType, "TARGET/1"),
      ),
    ).toThrow(/Relación no permitida/);
  });

  it("GENERATES es el único tipo de relación (D-083 MC-4)", () => {
    expect(Object.values(QmsRelationType)).toEqual([QmsRelationType.GENERATES]);
  });

  it("bloquea una relación del expediente consigo mismo", () => {
    expect(() =>
      canonicalOperationalRelation(
        rec("same", QmsRecordType.DEVIATION, "D/1"),
        rec("same", QmsRecordType.CAPA, "AC/1"),
      ),
    ).toThrow("Un expediente no puede relacionarse consigo mismo.");
  });

  it("expone por separado destinos y orígenes permitidos", () => {
    expect(allowedOutgoingRelationTypes(QmsRecordType.COMPLAINT)).toEqual([
      QmsRecordType.CAPA,
      QmsRecordType.RETURN,
    ]);
    expect(allowedIncomingRelationTypes(QmsRecordType.CAPA)).toEqual([
      QmsRecordType.DEVIATION,
      QmsRecordType.COMPLAINT,
      QmsRecordType.AUDIT,
      QmsRecordType.OOS,
    ]);
    expect(allowedOutgoingRelationTypes(QmsRecordType.OOS)).toEqual([QmsRecordType.CAPA, QmsRecordType.DEVIATION]);
    expect(allowedOutgoingRelationTypes(QmsRecordType.CHANGE_CONTROL)).toEqual([]);
    expect(allowedIncomingRelationTypes(QmsRecordType.CHANGE_CONTROL)).toEqual([]);
  });

  it("rechaza una codificación ambigua entre tipos compatibles", () => {
    expect(() =>
      selectOperationalRelationTarget(QmsRecordType.COMPLAINT, [
        rec("c1", QmsRecordType.CAPA, "X/1"),
        rec("v1", QmsRecordType.RETURN, "X/1"),
      ]),
    ).toThrow(/más de un tipo/);
  });

  it("ignora registros no compatibles al resolver una codificación", () => {
    const target = selectOperationalRelationTarget(QmsRecordType.DEVIATION, [
      rec("r1", QmsRecordType.COMPLAINT, "AC/1"),
      rec("c1", QmsRecordType.CAPA, "AC/1"),
    ]);
    expect(target.id).toBe("c1");
  });
});
