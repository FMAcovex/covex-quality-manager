import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const tables = { DEVIATION: "Deviation", COMPLAINT: "Complaint", OOS: "OosRecord" } as const;

/**
 * Expedientes cuya lista de otros lotes (D-094) contiene el texto buscado en el lote o el
 * nombre. Prisma no filtra texto dentro de JSON, así que se resuelve antes como lista de ids.
 */
export async function idsWithAdditionalLot(module: keyof typeof tables, query: string) {
  const q = query.trim();
  if (!q) return [];
  const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT t.id FROM ${Prisma.raw(`"${tables[module]}"`)} t
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(t."additionalLots") lot
      WHERE lot->>'lot' ILIKE ${pattern} OR lot->>'name' ILIKE ${pattern})
    LIMIT 500`);
  return rows.map((row) => row.id);
}
