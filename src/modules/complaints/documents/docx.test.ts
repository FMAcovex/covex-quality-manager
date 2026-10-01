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
      recallActionDetails:null,
      creditActionDetails:null,
      replacementActionDetails:null,
      otherResolutionDetails:"Seguimiento adicional",
    });
    expect(left).toContain("☒ DEVOLUCIÓN:");
    expect(right).toContain("☒ OTROS");
    expect(right).toContain("RECHAZO");
    expect(right).toContain("ABRIR CAPA");
    expect(right).toContain("Seguimiento adicional");
  });

  it("coloca el texto de cada acción no vinculable debajo de su opción", () => {
    const [,right]=complaintResolutionCells({
      resolutionActions:["RECALL","CREDIT","REPLACEMENT","OTHER"],
      immediateActionDetails:null,
      recallActionDetails:"Retirada lote A",
      creditActionDetails:"Abono de 10 unidades",
      replacementActionDetails:"Reposición del material",
      otherResolutionDetails:"Acción adicional",
    });
    expect(right).toContain("RETIRADA DEL MERCADO:\nRetirada lote A");
    expect(right).toContain("ABONO:\nAbono de 10 unidades");
    expect(right).toContain("REPOSICIÓN:\nReposición del material");
    expect(right).toContain("OTROS (especificar):\nAcción adicional");
  });
});
