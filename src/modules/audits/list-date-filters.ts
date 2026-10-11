export function nextReviewRange(filters: { nextReviewFrom?: string; nextReviewTo?: string }) {
  const errors: string[] = [];
  const parse = (value: string | undefined, label: string): Date | null => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith("0000-")) {
      const date = new Date(value + "T00:00:00.000Z");
      if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value) return date;
    }
    errors.push(`Fecha «${label}» de próxima revisión no válida. Usa YYYY-MM-DD.`);
    return null;
  };
  const from = parse(filters.nextReviewFrom, "desde");
  const to = parse(filters.nextReviewTo, "hasta");
  if (from && to && from > to) errors.push("La fecha «desde» de próxima revisión no puede ser posterior a «hasta».");
  return { from, to, errors };
}
