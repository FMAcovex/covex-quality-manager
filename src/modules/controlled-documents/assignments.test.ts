import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db", () => ({ prisma: {} }));
const { parseAssignmentsForm } = await import("./assignments");
const { canAssignRevision, currentRevisionFunction } = await import("./assignment-functions");

// D-118: responsables por función de la revisión y de la revisión periódica.
const revision = "22222222-2222-4222-8222-222222222222";
const user = "11111111-1111-4111-8111-111111111111";

function form(extra: Record<string, string> = {}) {
  const fd = new FormData();
  const values: Record<string, string> = {
    updatedAt: "2026-10-27T10:00:00.000Z", actor: "QA", periodicReviewResponsible: "", periodicReviewResponsibleUserId: user,
    revisionId: revision, [`${revision}.updatedAt`]: "2026-10-27T09:00:00.000Z",
    [`${revision}.preparationResponsible`]: "Responsable de departamento", [`${revision}.preparationResponsibleUserId`]: "",
    [`${revision}.preparationTargetDate`]: "2026-11-10", [`${revision}.reviewResponsible`]: "", [`${revision}.reviewResponsibleUserId`]: user,
    [`${revision}.reviewTargetDate`]: "", [`${revision}.approvalResponsible`]: "", [`${revision}.approvalResponsibleUserId`]: "", [`${revision}.approvalTargetDate`]: "",
    ...extra,
  };
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

describe("Asignación de responsables de PNT", () => {
  it("lee el maestro y cada revisión con sus tres funciones", () => {
    const parsed = parseAssignmentsForm(form());
    expect(parsed.periodic).toEqual({ text: "", userId: user });
    expect(parsed.revisions).toHaveLength(1);
    expect(parsed.revisions[0].preparation).toEqual({ text: "Responsable de departamento", userId: null, date: "2026-11-10" });
    expect(parsed.revisions[0].review).toEqual({ text: "", userId: user, date: "" });
  });

  it("valida en servidor el responsable del registro, la fecha y la longitud", () => {
    expect(() => parseAssignmentsForm(form({ actor: " " }))).toThrow("Indica el responsable del registro.");
    expect(() => parseAssignmentsForm(form({ [`${revision}.reviewTargetDate`]: "2026-13-40" }))).toThrow("La fecha prevista no es válida.");
    expect(() => parseAssignmentsForm(form({ periodicReviewResponsible: "x".repeat(201) }))).toThrow("como máximo 200");
  });

  it("rechaza fechas imposibles y revisiones repetidas en un formulario manipulado", () => {
    expect(() => parseAssignmentsForm(form({ [`${revision}.reviewTargetDate`]: "2026-02-31" }))).toThrow("La fecha prevista no es válida.");
    const fd = form();
    fd.append("revisionId", revision);
    expect(() => parseAssignmentsForm(fd)).toThrow("La revisión está repetida en el formulario.");
  });

  it("solo se asigna en elaboración, revisión o aprobación; cada fase tiene su función", () => {
    expect(["DRAFT", "IN_REVIEW", "PENDING_APPROVAL"].every(s => canAssignRevision(s as never))).toBe(true);
    expect(["IN_FORCE", "APPROVED_PENDING_EFFECTIVE", "OBSOLETE", "ANNULLED", "IMPORTED_PENDING"].some(s => canAssignRevision(s as never))).toBe(false);
    expect(currentRevisionFunction("IN_REVIEW")?.label).toBe("Revisa");
    expect(currentRevisionFunction("IN_FORCE")).toBeNull();
  });
});
