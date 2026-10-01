export const RETURN_DEPARTMENT_CODES = [
  "LG-00",
  "LG-10",
  "LG-20",
  "LG-30",
  "LG-40",
] as const;

export type ReturnDepartmentCode = (typeof RETURN_DEPARTMENT_CODES)[number];

export function isReturnDepartmentCode(code: string | null | undefined): code is ReturnDepartmentCode {
  return Boolean(code && RETURN_DEPARTMENT_CODES.includes(code as ReturnDepartmentCode));
}
