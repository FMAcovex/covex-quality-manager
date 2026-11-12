import { describe, expect, it } from "vitest";
import { legacySignerFields, parseSignatoryLines, readSignatories, replaceDocumentSignatories, reportSignatories, reportSignatoriesFromForm } from "./signatories";

describe("D-134 · firmantes de la auditoría", () => {
  it("lee «Nombre | Puesto» por línea, sin líneas vacías y admitiendo «|» en el puesto", () => {
    expect(parseSignatoryLines(" Ana | Técnica GC \n\nLuis\nEva | Dir. | Calidad", "REPORT", "REVIEWED")).toEqual([
      { document: "REPORT", role: "REVIEWED", name: "Ana", position: "Técnica GC" },
      { document: "REPORT", role: "REVIEWED", name: "Luis", position: "" },
      { document: "REPORT", role: "REVIEWED", name: "Eva", position: "Dir. | Calidad" },
    ]);
  });

  it("rechaza líneas sin nombre, más de 10 personas y textos largos, por campo", () => {
    const { errors } = reportSignatoriesFromForm({ reportPreparedBy: " | Sin nombre", reportReviewedBy: Array.from({ length: 11 }, (_, i) => `P${i}`).join("\n"), reportApprovedBy: `${"x".repeat(201)} | Puesto`, reportReceivedBy: "" });
    expect(Object.keys(errors).sort()).toEqual(["reportApprovedBy", "reportPreparedBy", "reportReviewedBy"]);
  });

  it("los campos anteriores llevan a todas las personas de cada función, para no perder firmantes en las plantillas previas", () => {
    const { list } = reportSignatoriesFromForm({ reportPreparedBy: "Ana | Técnica", reportReviewedBy: "Rosa | DT\nRaúl", reportApprovedBy: "Alba | DGC", reportReceivedBy: "" });
    expect(legacySignerFields(list)).toEqual({ preparedBy: "Ana", preparedPosition: "Técnica", reviewedBy: "Rosa; Raúl; Alba", reviewedPosition: "DT; —; DGC", receivedBy: "", receivedPosition: "" });
  });

  it("sustituye los firmantes de un documento y conserva los del otro", () => {
    const current = [{ document: "CAPA_PLAN", role: "APPROVED", name: "Plan", position: "" }, { document: "REPORT", role: "PREPARED", name: "Viejo", position: "" }];
    expect(replaceDocumentSignatories(current, "REPORT", [{ document: "REPORT", role: "PREPARED", name: "Nuevo", position: "" }]).map(s => s.name)).toEqual(["Plan", "Nuevo"]);
  });

  it("una entrada guardada no válida se ignora sin perder las demás", () => {
    expect(readSignatories([{ document: "CAPA_PLAN", role: "APPROVED", name: "Plan", position: "" }, { document: "OTRO", role: "X" }, "texto"]).map(s => s.name)).toEqual(["Plan"]);
    expect(readSignatories("no es una lista")).toEqual([]);
  });

  it("sin lista guardada usa los campos anteriores del expediente", () => {
    expect(reportSignatories({ signatories: [], preparedBy: "Ana", preparedPosition: "Técnica", reviewedBy: "Rosa", reviewedPosition: null, receivedBy: null, receivedPosition: null }).map(s => `${s.role}:${s.name}`)).toEqual(["PREPARED:Ana", "REVIEWED:Rosa"]);
  });
});

describe("D-136 · firmantes del plan CAPA por función", () => {
  it("revisión M4: una función que el formulario no envía conserva sus personas", async () => {
    const { mergeSignatoryRoles } = await import("./signatories");
    const current = [
      { document: "CAPA_PLAN" as const, role: "PREPARED" as const, name: "Elabora", position: "" },
      { document: "CAPA_PLAN" as const, role: "APPROVED" as const, name: "Aprueba", position: "" },
    ];
    const next = [{ document: "CAPA_PLAN" as const, role: "REVIEWED" as const, name: "Revisa", position: "" }];
    expect(mergeSignatoryRoles(current, next, ["REVIEWED"]).map(s => s.name)).toEqual(["Elabora", "Revisa", "Aprueba"]);
  });
});

