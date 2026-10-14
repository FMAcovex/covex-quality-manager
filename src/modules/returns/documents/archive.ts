import { storeWorkingDocument } from "@/lib/qms/working-document";
import {createHash} from "node:crypto";
import type {DocumentType,Prisma} from "@prisma/client";
import {serializeReturnVersion,snapshotJson} from "@/lib/qms/versioning";
import type {getReturnDetail} from "../queries";
export async function archiveReturnDocument(record:NonNullable<Awaited<ReturnType<typeof getReturnDetail>>>,buffer:Buffer,fileName:string,documentType:DocumentType,templateVersionId:string|null,productId?:string){
 const mimeType="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
 return storeWorkingDocument({data:{qmsRecordId:record.qmsRecordId,recordVersionId:record.qmsRecord.versions.at(-1)?.id,documentType,templateVersionId,fileData:new Uint8Array(buffer),fileName,mimeType,checksum:createHash("sha256").update(buffer).digest("hex"),generatedByText:process.env.DEFAULT_ACTOR_NAME||record.createdByText,metadata:{source:"download",productId:productId??null,sourceSnapshot:snapshotJson(serializeReturnVersion(record))} as Prisma.InputJsonObject}});
}
