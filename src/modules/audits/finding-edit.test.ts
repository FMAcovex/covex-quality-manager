import { describe, expect, it } from "vitest";
import { findingEditHref, parseFindingEdit } from "./finding-edit";

const id = "6f2b1c7e-9a4d-4b8e-8c1f-2d3e4f5a6b7c";
describe("parseFindingEdit", () => {
  it("interpreta cada elemento editable", () => {
    expect(parseFindingEdit(`finding:${id}`)).toEqual({ kind: "finding", id });
    expect(parseFindingEdit(`action:${id}`)).toEqual({ kind: "action", id });
    expect(parseFindingEdit(`new-action:${id}`)).toEqual({ kind: "new-action", findingId: id });
    expect(parseFindingEdit(`link:${id}`)).toEqual({ kind: "link", findingId: id });
    expect(parseFindingEdit(`justify:${id}`)).toEqual({ kind: "justify", findingId: id });
    expect(parseFindingEdit("new-finding")).toEqual({ kind: "new-finding" });
  });
  it("ignora valores no válidos", () => {
    expect(parseFindingEdit("action:no-uuid")).toBeNull();
    expect(parseFindingEdit("otro:" + id)).toBeNull();
    expect(parseFindingEdit(undefined)).toBeNull();
  });
});
describe("findingEditHref", () => {
  it("construye la dirección con edición y ancla", () => {
    expect(findingEditHref("a1", "justify:f1", "audit-finding-f1")).toBe("/audits/a1?tab=findings&edit=justify%3Af1#audit-finding-f1");
    expect(findingEditHref("a1", null, "audit-action-x")).toBe("/audits/a1?tab=findings#audit-action-x");
  });
});
