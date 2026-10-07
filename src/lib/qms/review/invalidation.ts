import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

const modulePaths = {
  DEVIATION: "/deviations", CAPA: "/capa", COMPLAINT: "/complaints",
  RETURN: "/returns", CHANGE_CONTROL: "/changes",
};

export async function invalidateReviewRecord(qmsRecordId: string) {
  const record = await prisma.qmsRecord.findUniqueOrThrow({
    where: { id: qmsRecordId }, select: { recordType: true },
  });
  const path = modulePaths[record.recordType];
  revalidatePath(path);
  revalidatePath(`${path}/[id]`, "page");
}
