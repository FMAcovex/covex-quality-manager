import type { Prisma } from "@prisma/client";

// Preserve every scalar documentary field except the content buffer.
// Downloads/generators keep their existing dedicated binary readers and ownership checks.
export const versionDocumentMetadata = {
  id: true, recordVersionId: true, kind: true, fileName: true, mimeType: true, fileSize: true,
  checksum: true, uploadedByText: true, uploadedAt: true, custodyId: true,
} satisfies Prisma.RecordVersionDocumentSelect;
export const generatedDocumentMetadata = {
  authenticatedUserId: true,
  id: true, qmsRecordId: true, recordVersionId: true, documentType: true, templateVersionId: true,
  generatedAt: true, generatedByText: true, fileName: true, mimeType: true, checksum: true, metadata: true,
} satisfies Prisma.GeneratedDocumentSelect;
export const templateMetadata = {
  id: true, module: true, documentType: true, versionCode: true, filePath: true, fileName: true,
  mimeType: true, fileSize: true, checksum: true, effectiveFrom: true, effectiveTo: true, isActive: true, createdAt: true,
} satisfies Prisma.TemplateVersionSelect;
