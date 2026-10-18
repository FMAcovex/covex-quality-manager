import { z } from "zod";

// Alta de varios departamentos de una vez desde el índice de PNT (D-097).
const departmentSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2}-\d{2}$/, "Código de departamento no válido (formato XX-00)."),
  name: z.string().trim().min(1, "Cada departamento necesita nombre.").max(200, "El nombre admite 200 caracteres."),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

/** Lista de departamentos enviada como JSON; rechaza códigos repetidos y listas vacías. */
export function parseDepartmentList(raw: unknown): { departments: DepartmentInput[]; error?: string } {
  let value: unknown;
  try { value = JSON.parse(typeof raw === "string" ? raw : ""); } catch { return { departments: [], error: "Lista de departamentos no válida." }; }
  const parsed = z.array(departmentSchema).min(1, "Selecciona al menos un departamento.").max(100, "Como máximo 100 departamentos de una vez.").safeParse(value);
  if (!parsed.success) return { departments: [], error: parsed.error.issues[0]?.message ?? "Lista de departamentos no válida." };
  const codes = parsed.data.map((d) => d.code);
  if (new Set(codes).size !== codes.length) return { departments: [], error: "Hay códigos de departamento repetidos." };
  return { departments: parsed.data };
}
