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
