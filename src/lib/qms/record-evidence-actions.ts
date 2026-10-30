"use server";

import { revalidatePath } from "next/cache";
import { authorizedAction } from "@/lib/auth/action-guard";
import { prisma } from "@/lib/db";
import { signedDocumentActor } from "./signed-version-document";
import { storeRecordEvidence } from "./record-evidence";
import { figureSectionLabel, parseFigureSection } from "@/modules/deviations/figures";

export type RecordEvidenceState = { error: string | null; success: string | null };

type EvidenceModule = "deviation" | "capa" | "changeControl" | "complaint" | "returnRecord" | "oosRecord";
const detailPaths: Record<EvidenceModule, string> = {
  deviation: "/deviations", capa: "/capa", changeControl: "/changes", complaint: "/complaints", returnRecord: "/returns", oosRecord: "/oos",
};

async function qmsRecordIdOf(module: EvidenceModule, id: string) {
  const where = { where: { id }, select: { qmsRecordId: true } } as const;
  switch (module) {
    case "deviation": return (await prisma.deviation.findUnique(where))?.qmsRecordId;
    case "capa": return (await prisma.capa.findUnique(where))?.qmsRecordId;
    case "changeControl": return (await prisma.changeControl.findUnique(where))?.qmsRecordId;
    case "complaint": return (await prisma.complaint.findUnique(where))?.qmsRecordId;
    case "returnRecord": return (await prisma.returnRecord.findUnique(where))?.qmsRecordId;
    case "oosRecord": return (await prisma.oosRecord.findUnique(where))?.qmsRecordId;
  }
}

async function uploadEvidence(module: EvidenceModule, id: string, formData: FormData): Promise<RecordEvidenceState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona el archivo de la evidencia.", success: null };
  const qmsRecordId = await qmsRecordIdOf(module, id);
  if (!qmsRecordId) return { error: "El expediente no existe.", success: null };
  let section: string | null = null;
  try {
    // D-125: solo las desviaciones tienen figuras por apartado.
    section = module === "deviation" ? parseFigureSection(formData.get("section")) : null;
    await storeRecordEvidence({
      figure: section ? { section, label: figureSectionLabel(section) } : null,
      qmsRecordId,
      file,
      description: String(formData.get("description") ?? ""),
      reference: String(formData.get("reference") ?? ""),
      actor: signedDocumentActor(formData),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo adjuntar la evidencia.", success: null };
  }
  revalidatePath(`${detailPaths[module]}/${id}`);
  return { error: null, success: section ? `Figura adjuntada en «${figureSectionLabel(section)}».` : `Evidencia «${file.name}» adjuntada.` };
}

async function uploadDeviationEvidenceActionAuthenticatedContent(deviationId: string, _state: RecordEvidenceState, formData: FormData) {
  return uploadEvidence("deviation", deviationId, formData);
}
async function uploadCapaEvidenceActionAuthenticatedContent(capaId: string, _state: RecordEvidenceState, formData: FormData) {
  return uploadEvidence("capa", capaId, formData);
}
async function uploadChangeControlEvidenceActionAuthenticatedContent(changeControlId: string, _state: RecordEvidenceState, formData: FormData) {
  return uploadEvidence("changeControl", changeControlId, formData);
}
async function uploadComplaintEvidenceActionAuthenticatedContent(complaintId: string, _state: RecordEvidenceState, formData: FormData) {
  return uploadEvidence("complaint", complaintId, formData);
}
async function uploadReturnEvidenceActionAuthenticatedContent(returnId: string, _state: RecordEvidenceState, formData: FormData) {
  return uploadEvidence("returnRecord", returnId, formData);
}
async function uploadOosEvidenceActionAuthenticatedContent(oosId: string, _state: RecordEvidenceState, formData: FormData) {
  return uploadEvidence("oosRecord", oosId, formData);
}

export async function uploadDeviationEvidenceAction(...args: Parameters<typeof uploadDeviationEvidenceActionAuthenticatedContent>) {
  return authorizedAction("uploadDeviationEvidenceAction", args, authenticated => uploadDeviationEvidenceActionAuthenticatedContent(...authenticated as Parameters<typeof uploadDeviationEvidenceActionAuthenticatedContent>));
}

export async function uploadCapaEvidenceAction(...args: Parameters<typeof uploadCapaEvidenceActionAuthenticatedContent>) {
  return authorizedAction("uploadCapaEvidenceAction", args, authenticated => uploadCapaEvidenceActionAuthenticatedContent(...authenticated as Parameters<typeof uploadCapaEvidenceActionAuthenticatedContent>));
}

export async function uploadChangeControlEvidenceAction(...args: Parameters<typeof uploadChangeControlEvidenceActionAuthenticatedContent>) {
  return authorizedAction("uploadChangeControlEvidenceAction", args, authenticated => uploadChangeControlEvidenceActionAuthenticatedContent(...authenticated as Parameters<typeof uploadChangeControlEvidenceActionAuthenticatedContent>));
}

export async function uploadComplaintEvidenceAction(...args: Parameters<typeof uploadComplaintEvidenceActionAuthenticatedContent>) {
  return authorizedAction("uploadComplaintEvidenceAction", args, authenticated => uploadComplaintEvidenceActionAuthenticatedContent(...authenticated as Parameters<typeof uploadComplaintEvidenceActionAuthenticatedContent>));
}

export async function uploadReturnEvidenceAction(...args: Parameters<typeof uploadReturnEvidenceActionAuthenticatedContent>) {
  return authorizedAction("uploadReturnEvidenceAction", args, authenticated => uploadReturnEvidenceActionAuthenticatedContent(...authenticated as Parameters<typeof uploadReturnEvidenceActionAuthenticatedContent>));
}

export async function uploadOosEvidenceAction(...args: Parameters<typeof uploadOosEvidenceActionAuthenticatedContent>) {
  return authorizedAction("uploadOosEvidenceAction", args, authenticated => uploadOosEvidenceActionAuthenticatedContent(...authenticated as Parameters<typeof uploadOosEvidenceActionAuthenticatedContent>));
}
