export type RelationActionState = {
  error: string | null;
  success?: string | null;
};

export type RelationTargetOption = {
  value: "DEVIATION" | "CAPA" | "COMPLAINT" | "RETURN" | "AUDIT" | "OOS";
  label: string;
};
