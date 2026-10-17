export function queryList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function appendFilterValues(
  params: URLSearchParams,
  key: string,
  value: string | string[] | undefined,
) {
  if (Array.isArray(value)) {
    value.filter(Boolean).forEach((item) => params.append(key, item));
    return;
  }
  if (value) params.set(key, value);
}

export function validValues(values: string[] | undefined, allowed: readonly string[]) {
  if (!values?.length) return [];
  const allowedSet = new Set(allowed);
  return values.filter((value) => allowedSet.has(value));
}

export function validYears(values: string[] | undefined) {
  return (values ?? []).filter((value) => /^\d{4}$/.test(value)).map(Number);
}

export type FilterOption = { value: string; label: string };
export type FilterDefinition = { name: string; label: string; options: readonly FilterOption[]; format?: (value: string) => string };
export type ActiveFilterChip = { key: string; label: string; href: string };

/**
 * Filtros aplicados de un listado como etiquetas, cada una con el enlace que la quita
 * (sin tocar el resto de la consulta y volviendo a la primera página). Los valores
 * vacíos son el valor por defecto del filtro y no se muestran.
 */
export function activeFilterChips(
  root: string,
  query: Record<string, string | string[] | undefined>,
  definitions: readonly FilterDefinition[],
): ActiveFilterChip[] {
  return definitions.flatMap((definition) =>
    queryList(query[definition.name]).map((value) => {
      const params = new URLSearchParams();
      for (const [key, raw] of Object.entries(query)) {
        if (key === "page") continue;
        for (const item of queryList(raw)) {
          if (key !== definition.name || item !== value) params.append(key, item);
        }
      }
      const label = definition.options.find((option) => option.value === value)?.label ?? definition.format?.(value) ?? value;
      const search = params.toString();
      return { key: `${definition.name}:${value}`, label: `${definition.label}: ${label}`, href: search ? `${root}?${search}` : root };
    }),
  );
}
