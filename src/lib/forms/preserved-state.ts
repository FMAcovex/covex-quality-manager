export type SubmittedFormValues = Record<string, string | string[]>;

export type PreservedFormState = {
  submittedValues?: SubmittedFormValues;
  formRevision?: number;
};

export function submittedValues(formData: FormData): SubmittedFormValues {
  const result: SubmittedFormValues = {};
  for (const key of new Set(Array.from(formData.keys()))) {
    const values = formData
      .getAll(key)
      .filter((value): value is string => typeof value === "string");
    result[key] = values.length > 1 ? values : values[0] ?? "";
  }
  return result;
}

export function preserveFormState<T extends object>(
  previous: PreservedFormState,
  formData: FormData,
  state: T,
): T & PreservedFormState {
  return {
    ...state,
    submittedValues: submittedValues(formData),
    formRevision: (previous.formRevision ?? 0) + 1,
  };
}

export function submittedDefaults<T extends object>(
  defaults: T,
  values?: SubmittedFormValues,
): T {
  if (!values) return defaults;
  return new Proxy(defaults, {
    get(target, property, receiver) {
      if (typeof property === "string" && property in values) {
        return values[property];
      }
      return Reflect.get(target, property, receiver);
    },
  });
}
