import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType, QmsRecordType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadStoredTemplateAsset, StoredTemplateIntegrityError } from "@/modules/configuration/template-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentType(fileName: string | null) {
  const lower = fileName?.toLowerCase() ?? "";
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function safe(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const moduleRaw = url.searchParams.get("module") ?? "";
  const documentTypeRaw = url.searchParams.get("documentType") ?? "";
  const version = url.searchParams.get("version")?.trim() || null;

  if (!Object.values(QmsRecordType).includes(moduleRaw as QmsRecordType)) {
    return NextResponse.json({ error: "Módulo no válido." }, { status: 400 });
  }
  if (!Object.values(DocumentType).includes(documentTypeRaw as DocumentType)) {
    return NextResponse.json({ error: "Tipo documental no válido." }, { status: 400 });
  }

  const moduleValue = moduleRaw as QmsRecordType;
  const documentType = documentTypeRaw as DocumentType;
  const template = await prisma.templateVersion.findFirst({
    where: {
      module: moduleValue,
      documentType,
      ...(version ? { versionCode: version } : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
  });

  if (!template) {
    return NextResponse.json(
      { error: "No hay una plantilla oficial cargada para este anexo." },
      { status: 404 },
    );
  }

  try {
    let buffer = await loadStoredTemplateAsset(moduleValue, documentType, template.versionCode);
    if (!buffer && template.filePath) {
      buffer = await readFile(path.resolve(process.cwd(), template.filePath));
    }
    if (!buffer) {
      return NextResponse.json({ error: "La plantilla no tiene archivo asociado." }, { status: 404 });
    }

    const fileName =
      template.fileName ??
      `${documentType}_${safe(template.versionCode)}.${documentType.includes("LIST") ? "xlsx" : "docx"}`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType(fileName),
        "Content-Disposition": `attachment; filename="${safe(fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof StoredTemplateIntegrityError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
