import { expect, it } from "vitest";
import { complaintAnnexIVDefaultVersion } from "./template-version";

it("sin plantilla del Anexo IV asignada, usa la versión del Anexo III o «03»", () => {
  expect(complaintAnnexIVDefaultVersion({ annexIIITemplateVersion: { versionCode: "04" } })).toBe("04");
  expect(complaintAnnexIVDefaultVersion({ annexIIITemplateVersion: null })).toBe("03");
  expect(complaintAnnexIVDefaultVersion({})).toBe("03");
});
