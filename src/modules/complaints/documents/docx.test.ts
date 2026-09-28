import { describe, expect, it } from "vitest";
import { complaintClassificationMarks, complaintResolutionCells } from "@/modules/complaints/documents/docx";

describe("Reclamaciones Anexo III v03", () => {
  it("marca solo la casilla de clasificación sin sustituir el texto oficial", () => {
    expect(complaintClassificationMarks("NO_GMP_IMPACT")).toEqual(["☐","☐","☐","☒"]);
    expect(complaintClassificationMarks("MAJOR")).toEqual(["☐","☒","☐","☐"]);
  });

  it("mantiene las ocho opciones oficiales y agrupa acciones extra en Otros", () => {
    const [left,right]=complaintResolutionCells({
      resolutionActions:["RETURN","REJECT","OPEN_CAPA"],
      immediateActionDetails:null,
      otherResolutionDetails:"Seguimiento adicional",
    });
    expect(left).toContain("☒ DEVOLUCIÓN:");
    expect(right).toContain("☒ OTROS");
    expect(right).toContain("RECHAZO");
    expect(right).toContain("ABRIR CAPA");
    expect(right).toContain("Seguimiento adicional");
  });
});
