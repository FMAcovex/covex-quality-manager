import { describe, expect, it } from "vitest";
import { parseComplaintForm } from "@/modules/complaints/validation";

describe("parseComplaintForm · D5.4C", () => {
  it("permite guardar una reclamación borrador incompleta", () => {
    const form = new FormData();
    form.set("status", "DRAFT");

    const parsed = parseComplaintForm(form);

    expect(parsed.errors).toEqual([]);
    expect(parsed.values.status).toBe("DRAFT");
    expect(parsed.values.businessCode).toBeNull();
  });

  it("exige los campos operativos al pasar a abierta", () => {
    const form = new FormData();
    form.set("status", "OPEN");

    const parsed = parseComplaintForm(form);

    expect(parsed.errors).toContain("El departamento es obligatorio.");
    expect(parsed.errors).toContain("La fecha de apertura es obligatoria.");
    expect(parsed.errors).toContain("Debe indicarse quién cumplimenta el expediente.");
    expect(parsed.errors).toContain("Debe indicarse el cliente/proveedor.");
    expect(parsed.errors).toContain("La descripción de la reclamación es obligatoria.");
  });

  it("mantiene las reglas de cierre fuera de borrador", () => {
    const form = new FormData();
    form.set("status", "CLOSED");
    form.set("departmentId", "department-1");
    form.set("openedAt", "2026-09-30");
    form.set("createdByText", "Usuario demo");
    form.set("complaintType", "CUSTOMER");
    form.set("partyName", "Cliente demo");
    form.set("description", "Reclamación demo");
    form.set("effectivenessStatus", "PENDING");

    const parsed = parseComplaintForm(form);

    expect(parsed.errors).toContain("Una reclamación cerrada requiere fecha de cierre.");
    expect(parsed.errors).toContain("Una reclamación cerrada requiere conclusión.");
    expect(parsed.errors).toContain("No puede cerrarse con eficacia pendiente. Indica Aceptable, No aceptable o No requerida.");
  });
});
