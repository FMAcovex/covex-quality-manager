import { z } from "zod";

// Otros lotes afectados (D-094): el primer lote sigue en los campos de siempre; los demás se
// guardan como lista con las mismas columnas. En el anexo impreso cada columna muestra todos
// los valores, uno por línea, en la misma casilla de la plantilla aprobada.
export const MAX_ADDITIONAL_LOTS = 50;

const text = z.string().trim().max(200, "Texto demasiado largo (máx. 200).");
export const additionalLotSchema = z.object({
  kind: z.enum(["PRODUCT", "MATERIAL"]).optional(),
  name: text.default(""),
  lot: z.string({ required_error: "Cada lote adicional necesita número de lote." }).trim()
    .min(1, "Cada lote adicional necesita número de lote.").max(200, "Texto demasiado largo (máx. 200)."),
  size: text.default(""),
  quantity: text.default(""),
});
export type AdditionalLot = z.infer<typeof additionalLotSchema>;

/** Lee la lista del campo oculto del formulario; devuelve error legible si no es válida. */
export function parseAdditionalLots(raw: FormDataEntryValue | null): { lots: AdditionalLot[]; error?: string } {
  if (typeof raw !== "string" || !raw.trim()) return { lots: [] };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { lots: [], error: "La lista de otros lotes no es válida." }; }
  const rows = Array.isArray(value)
    ? value.filter((row) => row && typeof row === "object" && Object.values(row as Record<string, unknown>).some((cell) => typeof cell === "string" && cell.trim() && cell !== "PRODUCT" && cell !== "MATERIAL"))
    : value;
  const parsed = z.array(additionalLotSchema).max(MAX_ADDITIONAL_LOTS, `Como máximo ${MAX_ADDITIONAL_LOTS} lotes adicionales.`).safeParse(rows);
  return parsed.success ? { lots: parsed.data } : { lots: [], error: parsed.error.issues[0]?.message ?? "Revisa los otros lotes." };
}

/** Lista guardada (JSON de la base) a objetos tipados; ignora lo que no encaje. */
export function storedAdditionalLots(value: unknown): AdditionalLot[] {
  const parsed = z.array(additionalLotSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Valor de una columna para el anexo: el principal y los adicionales, uno por línea. */
export function lotColumn(primary: string | null | undefined, lots: AdditionalLot[], field: keyof Omit<AdditionalLot, "kind">) {
  const values = [primary?.trim() ?? "", ...lots.map((lot) => lot[field]?.trim() ?? "")];
  // Si solo hay valor principal no se añaden líneas vacías; con adicionales se respetan las filas.
  return lots.length ? values.map((value) => value || "—").join("\n") : values[0];
}

/** Texto plano para buscar (lote, nombre), usado en la búsqueda global. */
export function additionalLotsSummary(lots: AdditionalLot[]) {
  return lots.map((lot) => [lot.name, lot.lot].filter(Boolean).join(" ")).join(" / ");
}
