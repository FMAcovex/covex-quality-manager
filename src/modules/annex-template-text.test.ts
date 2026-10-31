import { describe, expect, it, vi } from "vitest";
import { docxCellTexts, missingTemplateWords, syntheticDocx } from "@/lib/ooxml/template-text";
import { getZipEntryText, readZip } from "@/lib/ooxml/zip";
import type { ChangeDocumentRecord } from "@/modules/change-control/documents/types";
import type { ReturnDocumentRecord } from "@/modules/returns/documents/docx";

// Plantillas sintéticas con los textos literales de las plantillas oficiales en las celdas
// afectadas por F5, F7–F11 (verificación de anexos del 18/10/2026, D-098). Las plantillas
// reales no se versionan.
const templates = vi.hoisted(() => ({ current: Buffer.alloc(0) as Buffer }));
vi.mock("@/modules/change-control/documents/templates", () => ({
  loadChangeAnnexIIITemplate: async () => templates.current,
  loadChangeAnnexIVTemplate: async () => templates.current,
  loadChangeAnnexVTemplate: async () => templates.current,
}));
vi.mock("@/modules/returns/documents/templates", () => ({ loadReturnPntTemplate: async () => templates.current }));

const { generateChangeAnnexIII } = await import("@/modules/change-control/documents/annex-iii");
const { generateChangeAnnexIV } = await import("@/modules/change-control/documents/annex-iv");
const { generateChangeAnnexV } = await import("@/modules/change-control/documents/annex-v");
const { generateReturnAnnexIII, generateReturnAnnexV } = await import("@/modules/returns/documents/docx");

const grid = (tables: number, extra: Record<number, Record<string, string | { text: string; sdt?: boolean }>>) =>
  Array.from({ length: tables }, (_, index) => ({ rows: 20, cells: 6, text: extra[index] }));

/** Cada texto de plantilla indicado sigue en su celda del anexo generado. */
function expectTemplateTextKept(output: Buffer, tables: Record<number, Record<string, string | { text: string }>>) {
  const cells = docxCellTexts(output);
  for (const [table, entries] of Object.entries(tables)) {
    for (const [position, value] of Object.entries(entries)) {
      const [row, cell] = position.split(".").map(Number);
      const template = typeof value === "string" ? value : value.text;
      expect(missingTemplateWords(template, cells[Number(table)][row][cell]), `T${table}.F${row}.C${cell}`).toEqual([]);
    }
  }
  return cells;
}

const d = (value: string) => new Date(`${value}T00:00:00Z`);
const change: ChangeDocumentRecord = {
  qmsRecord: { businessCode: "C/GC-00/001/2096" },
  scope: ["PROCESS"],
  requestDecision: "ACCEPTED",
  requestDecisionResponsible: "Responsable ficticio",
  requestDecisionRole: "Director ficticio",
  requestDecisionDate: d("2096-01-14"),
  committeeRequired: true,
  committeeDetails: "Comité ficticio",
  clientNotificationRequired: false,
  authorityRequired: false,
  pqrRequired: "NO",
  stabilityRequired: "YES",
  stabilityAccelerated: true,
  stabilityOngoing: false,
  additionalAnalysisRequired: "NA",
  additionalValidationRequired: "YES",
  additionalValidationDetails: "Validación ficticia",
  otherImplicationRequired: false,
  dictamenResult: "APPROVED",
  executionStatus: "EXECUTED",
  effectivenessStatus: "NOT_APPLICABLE",
  finalStatus: "OPEN",
  tasks: [],
  followups: [
    { id: "f0", sequenceNumber: 0, followupDate: d("2096-01-20"), responsible: "Seguimiento ficticio", executionStatus: "EXECUTED", effectivenessStatus: "ACCEPTABLE", closeChange: false, taskStates: [] },
    { id: "f1", sequenceNumber: 1, followupDate: d("2096-02-20"), responsible: "Seguimiento ficticio", executionStatus: "EXECUTED", effectivenessStatus: "NOT_APPLICABLE", effectivenessObservations: "Observación ficticia", closeChange: true, approvalByText: "Aprobador ficticio", taskStates: [] },
  ],
};

describe("Anexos sobre plantilla: el texto oficial se conserva (D-098)", () => {
  it("Control de cambios III (F7): nombre y cargo bajo la etiqueta de aceptación", async () => {
    const labels = { 0: { "15.0": "Nombre y cargo del responsable que acepta la solicitud: \n_________________________\n_________________________\n\nFirma: __________________   Fecha: ____/____/______" } };
    templates.current = syntheticDocx(grid(1, labels));
    const cells = expectTemplateTextKept(await generateChangeAnnexIII(change), labels);
    expect(cells[0][15][0]).toBe("Nombre y cargo del responsable que acepta la solicitud:\nResponsable ficticio\nDirector ficticio\n\nFirma: __________________   Fecha: 14/1/2096");
  });

  it("Control de cambios IV (F8): etiquetas de detalle y orden de las casillas de estabilidad", async () => {
    const labels = {
      3: {
        "0.2": "Justificar e indicar personal/departamentos implicados: \n___________________________________________",
        "1.2": "(si Sí, indicar fecha y evidencia): \n____________________________________________",
        "2.2": "(si Sí, indicar detalle):\n____________________________________________",
        "3.2": "Producto(s): ________________ \nPeriodo PQR: _______________",
        "4.2": "E. acelerada   ☐\nE. en curso     ☐",
        "5.2": "Especificar:\n ____________________________________________",
        "6.2": "Detalles:\n ____________________________________________",
        "7.2": "Especificar:\n ____________________________________________",
      },
    };
    templates.current = syntheticDocx(grid(4, labels));
    const cells = expectTemplateTextKept(await generateChangeAnnexIV(change), labels);
    expect(cells[3][0][2]).toBe("Justificar e indicar personal/departamentos implicados:\nComité ficticio");
    expect(cells[3][4][2]).toBe("E. acelerada   ☒\nE. en curso     ☐");
    expect(cells[3][6][2]).toBe("Detalles:\nValidación ficticia");
  });

  it("Control de cambios V (F9–F11): número e historial en sus casillas, sin «NO APLICA» y con los dos bloques de cierre", async () => {
    const labels = {
      0: { "2.0": "N.º de seguimiento:", "2.1": { text: " ", sdt: true }, "2.2": "Historial de Seguimientos:" },
      2: {
        "4.0": "☐ ACEPTABLE",
        "4.1": "☐ NO ACEPTABLE",
        "4.2": "☐ PENDIENTE",
        "11.0":
          "Cierre del Seguimiento: \n\nFirma: ________________________ Fecha: ____/____/______\n\nAprobación y cierre del cambio, si aplica (Gª Calidad / Dirección Técnica/Responsable Técnico actividad IPS) \n\nFirma: _________________________Fecha: ____/____/______",
      },
    };
    templates.current = syntheticDocx(grid(3, labels));
    const cells = expectTemplateTextKept(await generateChangeAnnexV(change, 1), labels);
    expect(cells[0][2].slice(0, 4)).toEqual(["N.º de seguimiento:", "01", "Historial de Seguimientos:", "00 (20/1/2096)\n01 (20/2/2096)"]);
    expect(cells[2][4]).toEqual(["☐ ACEPTABLE", "☐ NO ACEPTABLE", "☐ PENDIENTE"].concat(cells[2][4].slice(3)));
    expect(cells[2][5][1]).toBe("Comprobación de la eficacia: no aplica.\nObservación ficticia");
    expect(cells[2][11][0]).toContain("Gª Calidad / Dirección Técnica/Responsable Técnico actividad IPS)\nAprobador ficticio\n");
  });

  it("Devoluciones V (F5): el firmante solo rellena «D./D.ª» y no «Otra documentación»", async () => {
    const declaration = "D./D.ª ____________________________________________________, en calidad de responsable de la entidad/cliente indicado, DECLARA";
    const otherDocumentation = "☐ Otra documentación: ________________________________________________";
    templates.current = syntheticDocx(grid(6, { 2: { "0.0": `${declaration}\n${otherDocumentation}` } }));
    const record = {
      qmsRecord: { businessCode: "DEV/LG-001/2096" },
      customerEntity: "Cliente ficticio",
      communicationDate: d("2096-03-01"),
      conservationConditions: "Ambiente",
      customerDeclarationSignatoryName: "Firmante ficticio",
      customerDeclarationSignatoryRole: "Cargo ficticio",
      customerDeclarationSignedAt: d("2096-03-02"),
      customerDeclarationObservations: null,
      qaApprovalName: null,
      technicalApprovalName: null,
      products: [],
    } as unknown as ReturnDocumentRecord;
    const [paragraphs] = [docxCellTexts(await generateReturnAnnexV(record))[2][0][0].split("\n")];
    expect(paragraphs[0]).toBe("D./D.ª Firmante ficticio, en calidad de responsable de la entidad/cliente indicado, DECLARA");
    expect(paragraphs[1]).toBe(otherDocumentation);
  });

  it("detecta una etiqueta perdida y admite casillas marcadas y huecos rellenos", () => {
    expect(missingTemplateWords("Detalles: ____", "Valor")).toEqual(["Detalles:"]);
    expect(missingTemplateWords("☐ Sí ☐ No", "☐ Sí ☒ No")).toEqual([]);
    expect(missingTemplateWords("Cantidad ______", "Cantidad 25 kg")).toEqual([]);
  });
});

describe("Controles de cambios: tablas de los textos en su casilla (D-127)", () => {
  const table = (title: string) => ({ title, columns: ["Dato"], rows: [["valor"]] });
  const withTables = {
    ...change,
    description: "Descripción ficticia",
    evaluation: "Evaluación ficticia",
    dictamenObservations: "Observaciones ficticias",
    justification: "Justificación ficticia",
    providedDocuments: "Documentos ficticios",
    textTables: { description: [table("Plan")], justification: [table("Motivos")], providedDocuments: [table("Anexos")], evaluation: [table("Riesgos")], dictamenObservations: [table("Condiciones")] },
  } as ChangeDocumentRecord;
  const inSameCell = (xml: string, text: string, caption: string) => {
    const from = xml.indexOf(text), to = xml.indexOf(caption);
    return from > 0 && to > from && !xml.slice(from, to).includes("</w:tc>");
  };

  it("la solicitud (Anexo III) lleva las de la descripción; el dictamen (Anexo IV), las de evaluación y observaciones, con la numeración del expediente", async () => {
    templates.current = syntheticDocx(grid(1, {}));
    const iii = getZipEntryText(readZip(await generateChangeAnnexIII(withTables)), "word/document.xml");
    expect(inSameCell(iii, "Descripción ficticia", "Tabla 1. Plan")).toBe(true);
    expect(inSameCell(iii, "Justificación ficticia", "Tabla 2. Motivos")).toBe(true);
    expect(inSameCell(iii, "Documentos ficticios", "Tabla 3. Anexos")).toBe(true);
    expect(iii).not.toContain("Tabla 4.");
    templates.current = syntheticDocx(grid(4, {}));
    const iv = getZipEntryText(readZip(await generateChangeAnnexIV(withTables)), "word/document.xml");
    expect(inSameCell(iv, "Evaluación ficticia", "Tabla 4. Riesgos")).toBe(true);
    expect(inSameCell(iv, "Observaciones ficticias", "Tabla 5. Condiciones")).toBe(true);
    expect(iv).not.toContain("Tabla 1.");
  });
});

describe("Devoluciones: tablas de los textos en su casilla (D-127)", () => {
  const table = (title: string) => ({ title, columns: ["Dato"], rows: [["valor"]] });
  const product = (code: string) => ({ productNameCode: code, productType: "MEDICINE", format: null, lot: "L-1", expiryReanalysis: null, quantity: "1", unit: "ud" });
  const record = {
    qmsRecord: { businessCode: "DEV/LG-002/2096" },
    reasonObservations: "Motivo ficticio",
    finalDestination: "Destrucción",
    decisionObservations: "Decisión ficticia",
    customerDeclarationObservations: "Declaración ficticia",
    products: [product("P-1"), product("P-2"), product("P-3")],
    followups: [],
    extraData: null,
    textTables: { reasonObservations: [table("Incidencias")], decisionObservations: [table("Criterios")], customerDeclarationObservations: [table("Unidades")] },
  } as unknown as ReturnDocumentRecord;
  const inSameCell = (xml: string, text: string, caption: string) => {
    const from = xml.indexOf(text), to = xml.indexOf(caption);
    return from > 0 && to > from && !xml.slice(from, to).includes("</w:tc>");
  };

  it("el informe (Anexo III; las filas de productos copiadas no mueven sus casillas, que están en otras tablas) y la declaración (Anexo V) llevan sus tablas", async () => {
    templates.current = syntheticDocx(grid(9, {}));
    const iii = getZipEntryText(readZip(await generateReturnAnnexIII(record)), "word/document.xml");
    expect(inSameCell(iii, "Motivo ficticio", "Tabla 1. Incidencias")).toBe(true);
    expect(inSameCell(iii, "Decisión ficticia", "Tabla 2. Criterios")).toBe(true);
    expect(iii).not.toContain("Tabla 3.");
    templates.current = syntheticDocx(grid(6, {}));
    const v = getZipEntryText(readZip(await generateReturnAnnexV(record)), "word/document.xml");
    expect(inSameCell(v, "Declaración ficticia", "Tabla 3. Unidades")).toBe(true);
  });

  it("la tabla de la justificación del plazo excepcional sale solo con su texto (D-128)", async () => {
    const withAmbient = { ...record, textTables: { ambientPeriodRiskJustification: [table("Plazo")] } } as unknown as ReturnDocumentRecord;
    templates.current = syntheticDocx(grid(9, {}));
    const without = getZipEntryText(readZip(await generateReturnAnnexIII(withAmbient)), "word/document.xml");
    expect(without).not.toContain("Plazo");
    const justified = { ...withAmbient, extraData: { r4b: { ambientPeriodRiskJustification: "Justificación ficticia" } } } as unknown as ReturnDocumentRecord;
    const withText = getZipEntryText(readZip(await generateReturnAnnexIII(justified)), "word/document.xml");
    expect(inSameCell(withText, "Justificación ficticia", "Tabla 1. Plazo")).toBe(true);
  });
});

