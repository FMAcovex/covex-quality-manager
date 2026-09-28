import { describe, expect, it } from "vitest";
import { qmsRecordHref, qmsRecordTypeLabel } from "@/lib/qms/record-links";

describe("QMS record links", () => {
  it("routes all related records through the QMS resolver", () => {
    expect(qmsRecordHref("DEVIATION","qms-1")).toBe("/qms/qms-1");
    expect(qmsRecordHref("CAPA","qms-2")).toBe("/qms/qms-2");
    expect(qmsRecordHref("CHANGE_CONTROL","qms-3")).toBe("/qms/qms-3");
  });
  it("keeps Spanish record labels", () => {
    expect(qmsRecordTypeLabel("COMPLAINT")).toBe("Reclamación");
    expect(qmsRecordTypeLabel("RETURN")).toBe("Devolución");
  });
});
