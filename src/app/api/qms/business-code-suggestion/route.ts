import { QmsRecordType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  OperationalBusinessCodeError,
  operationalBusinessCodeFormat,
  suggestOperationalBusinessCode,
  type OperationalBusinessCodeContext,
} from "@/lib/qms/business-code";

export const runtime = "nodejs";

const supportedTypes = new Set<QmsRecordType>([
  QmsRecordType.CAPA,
  QmsRecordType.CHANGE_CONTROL,
  QmsRecordType.COMPLAINT,
  QmsRecordType.RETURN,
]);

function recordType(value: string | null) {
  if (!value) return null;
  const candidate = value as QmsRecordType;
  return supportedTypes.has(candidate) ? candidate : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = recordType(url.searchParams.get("recordType"));
  const year = Number(url.searchParams.get("year"));
  const departmentId = url.searchParams.get("departmentId")?.trim() || null;
  const actionType = url.searchParams.get("actionType")?.trim() || null;
  const complaintType = url.searchParams.get("complaintType")?.trim() || null;

  if (!type || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: "Tipo de expediente y año válidos son obligatorios." },
      { status: 400 },
    );
  }

  let departmentCode: string | null = null;
  if (
    type === QmsRecordType.CAPA ||
    type === QmsRecordType.CHANGE_CONTROL ||
    type === QmsRecordType.RETURN
  ) {
    if (!departmentId) {
      return NextResponse.json(
        { error: "El departamento/área es obligatorio para calcular la codificación." },
        { status: 400 },
      );
    }
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { code: true },
    });
    if (!department) {
      return NextResponse.json({ error: "El departamento no existe." }, { status: 404 });
    }
    departmentCode = department.code;
  }

  const context: OperationalBusinessCodeContext = {
    recordType: type,
    year,
    departmentCode,
    actionType:
      actionType === "CORRECTIVE" || actionType === "PREVENTIVE"
        ? actionType
        : null,
    complaintType:
      complaintType === "CUSTOMER" || complaintType === "PROVIDER"
        ? complaintType
        : null,
  };

  try {
    const suggestion = await suggestOperationalBusinessCode(prisma, context);
    return NextResponse.json({
      suggestion,
      format: operationalBusinessCodeFormat(context),
    });
  } catch (error) {
    const message =
      error instanceof OperationalBusinessCodeError || error instanceof Error
        ? error.message
        : "No se ha podido calcular la codificación.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
