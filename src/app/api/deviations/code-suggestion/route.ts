import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { suggestDeviationBusinessCode } from "@/lib/qms/business-code";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const departmentId = url.searchParams.get("departmentId")?.trim() || "";
  const year = Number(url.searchParams.get("year"));

  if (!departmentId || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Departamento y año válidos son obligatorios." }, { status: 400 });
  }

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { code: true },
  });
  if (!department) {
    return NextResponse.json({ error: "El departamento no existe." }, { status: 404 });
  }

  try {
    const suggestion = await suggestDeviationBusinessCode(prisma, department.code, year);
    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se ha podido calcular la sugerencia." },
      { status: 409 },
    );
  }
}
