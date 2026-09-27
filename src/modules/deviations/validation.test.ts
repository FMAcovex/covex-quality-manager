import { describe, expect, it } from "vitest";
import { parseDeviationForm } from "@/modules/deviations/validation";

function baseForm() {
  const form = new FormData();
  form.set("businessCode", "D/GC-00/001/2026");
  form.set("departmentId", "department-1");
  form.set("issueDate", "2026-09-27");
  form.set("whatHappened", "Se detectó una diferencia documental durante la revisión.");
  form.set("createdByText", "Usuario demo");
  form.set("status", "OPEN");
  return form;
}

describe("parseDeviationForm", () => {
  it("permite guardar una desviación abierta sin forzar investigación o cierre", () => {
    const parsed = parseDeviationForm(baseForm());
    expect(parsed.errors).toEqual([]);
  });

  it("exige trazabilidad mínima cuando se intenta cerrar", () => {
    const form = baseForm();
    form.set("status", "CLOSED");
    const parsed = parseDeviationForm(form);
    expect(parsed.errors).toContain("Para cerrar la desviación debe existir investigación.");
    expect(parsed.errors).toContain("Para cerrar la desviación debe existir causa raíz.");
    expect(parsed.errors).toContain("Para cerrar la desviación debe existir clasificación.");
    expect(parsed.errors).toContain("Para cerrar la desviación debe existir conclusión/cierre.");
    expect(parsed.errors).toContain("Para cerrar la desviación debe informarse la fecha de cierre.");
  });

  it("no permite indicar que procede CAPA sin definir una acción CAPA", () => {
    const form = baseForm();
    form.set("capaRequired", "true");
    const parsed = parseDeviationForm(form);
    expect(parsed.errors).toContain(
      "Se ha indicado que procede CAPA, pero no se ha definido ninguna acción CAPA.",
    );
  });
});
