import { describe, expect, it } from "vitest";
import { sanitizeOfficeMetadata } from "@/lib/ooxml/metadata";
import { type ZipEntry } from "@/lib/ooxml/zip";

describe("Office metadata sanitization", () => {
  it("removes inherited authors and SharePoint absolute paths", () => {
    const entries: ZipEntry[] = [
      {
        name: "docProps/core.xml",
        data: Buffer.from('<cp:coreProperties><dc:creator xmlns:dc="x">Author A</dc:creator><cp:lastModifiedBy>Author B</cp:lastModifiedBy><cp:lastPrinted>2026</cp:lastPrinted></cp:coreProperties>'),
      },
      {
        name: "xl/workbook.xml",
        data: Buffer.from('<workbook><mc:AlternateContent>https://example.invalid/sharepoint</mc:AlternateContent><xr:revisionPtr documentId="secret"/></workbook>'),
      },
    ];
    sanitizeOfficeMetadata(entries);
    const core = entries[0].data.toString();
    const workbook = entries[1].data.toString();
    expect(core).not.toContain("Author A");
    expect(core).not.toContain("Author B");
    expect(core).not.toContain("lastPrinted");
    expect(workbook).not.toContain("sharepoint");
    expect(workbook).not.toContain("revisionPtr");
  });
});
