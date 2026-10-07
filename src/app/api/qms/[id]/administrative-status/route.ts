import { NextResponse } from "next/server";
import { z } from "zod";
import { AdministrativeStatusError, changeAdministrativeStatus } from "@/lib/qms/administrative-status";
const payloadSchema = z.object({ action: z.enum(["ANNUL", "REACTIVATE"]), reason: z.string().trim().min(3).max(2000), actor: z.string().trim().min(1).max(200) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Acción, motivo y usuario son obligatorios." }, { status: 400 });
  try {
    const { action, reason, actor } = parsed.data;
    return NextResponse.json({ ok: true, status: await changeAdministrativeStatus(id, action, reason, actor) });
  } catch (error) {
    if (error instanceof AdministrativeStatusError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
