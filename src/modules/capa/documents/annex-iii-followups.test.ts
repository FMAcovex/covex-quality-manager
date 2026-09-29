import { describe, expect, it, vi } from "vitest";
import { getZipEntryText, readZip, writeZip } from "@/lib/ooxml/zip";
import { generateCapaAnnexIII } from "@/modules/capa/documents/annex-iii";

vi.mock("@/modules/capa/documents/templates", () => {
  const plain = () => "<w:tc><w:p><w:r><w:t>Vacío</w:t></w:r></w:p></w:tc>";
  const checkbox = () =>
    '<w:tc><w:sdt><w:sdtPr><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:p><w:r><w:t>☐</w:t></w:r></w:p></w:sdtContent></w:sdt></w:tc>';
  const table = (index: number, count: number) =>
    "<w:tbl>" + Array.from({ length: count }, (_, row) => {
      const checked = index === 0 ? [1, 6, 7, 8].includes(row) : [6, 9].includes(row);
      const cells = index === 0 ? 4 : row === 6 || row === 9 ? 3 : 2;
      return "<w:tr>" + Array.from({ length: cells }, () => checked ? checkbox() : plain()).join("") + "</w:tr>";
    }).join("") + "</w:tbl>";
  const xml = '<w:document><w:body>' + table(0, 18) + table(1, 16) + '</w:body></w:document>';
  return {
    loadCapaAnnexIIITemplate: async () =>
      writeZip([{ name: "word/document.xml", data: Buffer.from(xml) }]),
  };
});

describe("Anexo III CAPA con dos seguimientos", () => {
  it("conserva V01/V02 y cumplimenta estado y eficacia tras ampliar la tabla", async () => {
    const doc = await generateCapaAnnexIII({
      qmsRecord: { businessCode: "AC/C3/001/2097" },
      actionType: "CORRECTIVE",
      openedAt: new Date("2097-01-01"),
      originType: null, originCode: null, applicableTo: null,
      defectDescription: "C3 MARCA V00", rootCause: "Causa ficticia",
      status: "CLOSED", cancellationReason: null,
      effectivenessStatus: "CONFORMING", effectivenessCriteria: "Sin recurrencia",
      effectivenessAssessment: "Conforme", effectivenessEvidence: "EV-C3-EF",
      operationalClosedAt: new Date("2097-02-10"),
      effectiveClosedAt: new Date("2097-02-10"), conclusion: "Acción implantada",
      plannedActions: [{ description: "Acción C3", responsible: "QA", plannedExecutionDate: null, impact: null }],
      followups: [
        { sequenceNumber: 2, followupDate: new Date("2097-02-10"), reason: "Cierre",
          description: "C3 MARCA V02", observations: null, evidenceReference: "EV-C3-02", nextFollowupDate: null },
        { sequenceNumber: 1, followupDate: new Date("2097-01-10"), reason: "Revisión",
          description: "C3 MARCA V01", observations: null, evidenceReference: "EV-C3-01",
          nextFollowupDate: new Date("2097-02-10") },
      ],
      annexIIITemplateVersion: { versionCode: "05" },
    });
    const xml = getZipEntryText(readZip(doc), "word/document.xml");
    expect(xml).toContain("C3 MARCA V01");
    expect(xml).toContain("C3 MARCA V02");
    expect(xml).toContain("EV-C3-EF");
    expect(xml).toContain("Acción implantada");
    expect(xml).toContain("10/2/2097");
  });
});
