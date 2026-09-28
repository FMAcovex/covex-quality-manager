import { describe, expect, it } from "vitest";
import { changeAnnexVTaskValues } from "@/modules/change-control/documents/annex-v";

describe("Control de Cambios Anexo V", () => {
  it("mapea checkbox, acción, responsable y fechas en las seis columnas oficiales", () => {
    const values = changeAnnexVTaskValues(
      {
        description: "Actualizar el formulario DEMO",
        responsible: "Usuario demo",
        plannedDate: new Date("2026-10-10T00:00:00.000Z"),
        origin: "DICTAMEN",
      },
      {
        status: "PENDING",
        actualDate: null,
        evidenceComment: "Pendiente de ejecución.",
      },
    );
    expect(values).toHaveLength(6);
    expect(values[0]).toBe("☐");
    expect(values[1]).toBe("Actualizar el formulario DEMO");
    expect(values[2]).toBe("Usuario demo");
    expect(values[5]).toBe("Pendiente de ejecución.");
  });
});
