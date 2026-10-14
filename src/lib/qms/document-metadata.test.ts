import { Prisma } from "@prisma/client";
import { expect,it } from "vitest";
import { versionDocumentMetadata } from "./document-metadata";

it("retains every scalar version-document field including custody while excluding file bytes",()=>{
  const model=Prisma.dmmf.datamodel.models.find(model=>model.name==="RecordVersionDocument")!;
  const fields=model.fields.filter(field=>field.kind!=="object"&&field.name!=="fileData").map(field=>field.name).sort();
  expect(Object.keys(versionDocumentMetadata).sort()).toEqual(fields);
  expect(versionDocumentMetadata.custodyId).toBe(true);
  expect("fileData" in versionDocumentMetadata).toBe(false);
});
