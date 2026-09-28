export type RelationActionState = {
  error: string | null;
  success?: string | null;
};

export type RelationTargetOption = {
  value: "DEVIATION" | "CAPA" | "COMPLAINT" | "RETURN";
  label: string;
};
