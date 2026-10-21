/** Regla de asociación: mensaje exacto o patrón, y el `name` del campo del formulario al que pertenece. */
export type FieldIssueRule = readonly [match: string | RegExp, field: string | ((match: RegExpMatchArray) => string)];

/**
 * Errores de servidor por campo (D-117): agrupa los mensajes de validación por el `name` del campo al que
 * pertenecen, para marcarlo en el formulario. Los mensajes sin regla siguen como avisos generales.
 */
export function fieldIssuesFromErrors(errors: readonly string[], rules: readonly FieldIssueRule[]): Record<string, string[]> {
  const issues: Record<string, string[]> = {};
  for (const message of errors) {
    for (const [match, field] of rules) {
      const found = typeof match === "string" ? (message === match ? [message] as RegExpMatchArray : null) : message.match(match);
      if (!found) continue;
      const name = typeof field === "string" ? field : field(found);
      (issues[name] ??= []).push(message);
      break;
    }
  }
  return issues;
}

/** Mensajes que no pertenecen a ningún campo: siguen en el aviso general del formulario. */
export function generalErrors(errors: readonly string[] | undefined, issues: Record<string, string[]> | undefined): string[] {
  const keyed = new Set(Object.values(issues ?? {}).flat());
  return (errors ?? []).filter((message) => !keyed.has(message));
}
