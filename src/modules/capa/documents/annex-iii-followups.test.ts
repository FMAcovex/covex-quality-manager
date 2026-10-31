import { describe, expect, it, vi } from "vitest";
import { getZipEntryText, readZip } from "@/lib/ooxml/zip";
import { generateCapaAnnexIII } from "@/modules/capa/documents/annex-iii";

vi.mock("@/modules/capa/documents/templates", async () => {
  const { writeZip } = await import("@/lib/ooxml/zip");
  const plain = (text = "Vacío") =>
    `<w:tc><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const shaded = (text: string, fill: string) =>
    `<w:tc><w:tcPr><w:shd w:fill="${fill}"/></w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
  const checkbox = (text = "☐") =>
    `<w:tc><w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:sdtContent></w:sdt></w:tc>`;
  const table0 = () =>
    "<w:tbl>" +
    Array.from({ length: 18 }, (_, row) => {
      if (row === 5) return "<w:tr>" + shaded("ORIGEN", "D9D9D9") + "</w:tr>";
      if (row === 6) return "<w:tr>" + checkbox("☐ AUDITORIA") + checkbox("☐ INSPECCIÓN") + "</w:tr>";
      if (row === 7) return "<w:tr>" + checkbox("☐ DESVIACIÓN") + checkbox("☐ RECHAZOS") + "</w:tr>";
      if (row === 8) return "<w:tr>" + checkbox("☐ RECLAMACIÓN") + checkbox("☐ OTROS") + "</w:tr>";
      if (row === 1) return "<w:tr>" + checkbox("☐ Correctiva") + checkbox("☐ Preventiva") + "</w:tr>";
      const cells = row === 2 || row === 3 ? 4 : row === 4 ? 2 : row === 17 ? 4 : 1;
      return "<w:tr>" + Array.from({ length: cells }, () => plain()).join("") + "</w:tr>";
    }).join("") +
    "</w:tbl>";
  const table1 = () =>
    "<w:tbl>" +
    Array.from({ length: 16 }, (_, row) => {
      if (row === 6) return "<w:tr>" + checkbox() + checkbox() + checkbox() + "</w:tr>";
      if (row === 9) return "<w:tr>" + checkbox() + checkbox() + checkbox() + "</w:tr>";
      if (row === 10) return "<w:tr>" + plain("Valoración :") + "</w:tr>";
      const cells = [1, 2, 13, 14, 15].includes(row) ? 2 : 1;
      return "<w:tr>" + Array.from({ length: cells }, () => plain()).join("") + "</w:tr>";
    }).join("") +
    "</w:tbl>";
  const xml =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body>' +
    table0() +
    table1() +
    "</w:body></w:document>";
  return {
    loadCapaAnnexIIITemplate: async () =>
      writeZip([{ name: "word/document.xml", data: Buffer.from(xml) }]),
  };
});

describe("Anexo III CAPA por QmsRecordVersion", () => {
  it("usa metadata de seguimiento, orígenes y seguimiento de la acción sin tocar ORIGEN", async () => {
    const doc = await generateCapaAnnexIII({
      qmsRecord: { businessCode: "AC/C3/001/2097" },
      recordVersionSequenceNumber: 2,
      recordVersionReason: "Motivo V02",
      versionFollowupDate: new Date("2097-02-10"),
      actionType: "CORRECTIVE",
      openedAt: new Date("2097-01-01"),
      originType: "Desviación",
      originCode: "D/LEGACY/001/2097",
      origins: [
        { recordType: "DEVIATION", businessCode: "D/GC-00/001/2097" },
        { recordType: "DEVIATION", businessCode: "D/GC-00/002/2097" },
        { recordType: "COMPLAINT", businessCode: "REC-001-2097" },
      ],
      applicableTo: "Sistema C3",
      defectDescription: "Defecto C3",
      rootCause: "Causa ficticia",
      status: "CLOSED",
      operationalStatusDescription: "Acción completada",
      cancellationReason: null,
      effectivenessStatus: "CONFORMING",
      effectivenessAssessment: "Conforme",
      operationalClosedAt: new Date("2097-02-10"),
      effectiveClosedAt: new Date("2097-02-10"),
      conclusion: "Acción implantada",
      nextFollowupDate: new Date("2097-03-01"),
      actionFollowupObservations: "Observación general",
      plannedActions: [{
        description: "Acción C3",
        responsible: "QA",
        plannedExecutionDate: null,
        impact: null,
      }],
      actionFollowups: [
        { followupDate: new Date("2097-01-10"), description: "Revisión documental" },
        { followupDate: new Date("2097-02-10"), description: "Verificación final" },
      ],
      annexIIITemplateVersion: { versionCode: "05" },
    });

    const xml = getZipEntryText(readZip(doc), "word/document.xml");
    expect(xml).toContain("ORIGEN");
    expect(xml).toContain("D/GC-00/001/2097");
    expect(xml).toContain("D/GC-00/002/2097");
    expect(xml).toContain("REC-001-2097");
    expect(xml).toContain("Motivo V02");
    expect(xml).toContain("10/2/2097");
    expect(xml).toContain("Revisión documental");
    expect(xml).toContain("Verificación final");
    expect(xml).toContain("Observación general");
    expect(xml).not.toContain("Seguimiento 02:");
    expect(xml).not.toContain("Evidencia:");
    expect(xml).toContain('w:ascii="Arial"');
    expect(xml).toContain('<w:sz w:val="22"/>');
    expect(xml).toContain('<w:jc w:val="both"/>');
  });

  it("usa la fecha de apertura como fecha del Seguimiento 00 y no imprime motivo inicial", async () => {
    const doc = await generateCapaAnnexIII({
      qmsRecord: { businessCode: "AC/C3/002/2097" },
      recordVersionSequenceNumber: 0,
      recordVersionReason: "Informe inicial CAPA",
      versionFollowupDate: new Date("2097-01-30"),
      actionType: "PREVENTIVE",
      openedAt: new Date("2097-01-05"),
      originType: "Reclamación",
      originCode: "REC-002-2097",
      origins: [],
      applicableTo: "Producto",
      defectDescription: "Defecto",
      rootCause: "Causa",
      status: "OPEN",
      operationalStatusDescription: "En curso",
      cancellationReason: null,
      effectivenessStatus: "PENDING",
      effectivenessAssessment: "Pendiente",
      operationalClosedAt: null,
      effectiveClosedAt: null,
      conclusion: "Seguimiento",
      nextFollowupDate: new Date("2097-02-01"),
      actionFollowupObservations: "Sin observaciones",
      plannedActions: [{ description: "Acción", responsible: "QA", plannedExecutionDate: null, impact: null }],
      actionFollowups: [],
      annexIIITemplateVersion: { versionCode: "05" },
    });
    const xml = getZipEntryText(readZip(doc), "word/document.xml");
    expect(xml).toContain("5/1/2097");
    expect(xml).not.toContain("Informe inicial CAPA");
  });

  it("D-127: cada tabla va en la casilla de su apartado aunque se copien filas de acciones y seguimientos", async () => {
    const table = (title: string) => ({ title, columns: ["Dato"], rows: [["valor"]] });
    const doc = await generateCapaAnnexIII({
      qmsRecord: { businessCode: "AC/C3/003/2097" },
      recordVersionSequenceNumber: 1,
      recordVersionReason: "Motivo",
      versionFollowupDate: new Date("2097-02-10"),
      actionType: "CORRECTIVE",
      openedAt: new Date("2097-01-01"),
      originType: null,
      originCode: null,
      origins: [],
      applicableTo: "Sistema",
      defectDescription: "Defecto",
      rootCause: "Causa ficticia",
      status: "OPEN",
      operationalStatusDescription: "En curso",
      cancellationReason: null,
      effectivenessStatus: "PENDING",
      effectivenessAssessment: null,
      operationalClosedAt: null,
      effectiveClosedAt: null,
      conclusion: "Acción implantada",
      nextFollowupDate: null,
      actionFollowupObservations: "Observación general",
      plannedActions: [1, 2, 3].map((n) => ({ description: `Acción ${n}`, responsible: "QA", plannedExecutionDate: null, impact: null })),
      actionFollowups: [1, 2, 3].map((n) => ({ followupDate: new Date("2097-01-10"), description: `Seguimiento ${n}` })),
      textTables: { rootCause: [table("Causas")], "actionFollowups.1": [table("Pruebas")], actionFollowupObservations: [table("Revisiones")], conclusion: [table("Cierre")] },
      annexIIITemplateVersion: { versionCode: "05" },
    } as never);
    const xml = getZipEntryText(readZip(doc), "word/document.xml");
    const inSameCell = (text: string, caption: string) => {
      const from = xml.indexOf(text), to = xml.indexOf(caption);
      return from > 0 && to > from && !xml.slice(from, to).includes("</w:tc>");
    };
    expect(inSameCell("Causa ficticia", "Tabla 1. Causas")).toBe(true);
    // La tabla de un seguimiento de la acción va en la descripción de su fila copiada y numera en su orden.
    expect(inSameCell("Seguimiento 2", "Tabla 2. Pruebas")).toBe(true);
    expect(xml.indexOf("Tabla 2. Pruebas")).toBeLessThan(xml.indexOf("Seguimiento 3"));
    expect(inSameCell("Observación general", "Tabla 3. Revisiones")).toBe(true);
    expect(inSameCell("Acción implantada", "Tabla 4. Cierre")).toBe(true);
  });
});

