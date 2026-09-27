export function qmsBusinessKey(recordType: string, businessCode: string) {
  const type = recordType.trim().toUpperCase();
  const code = businessCode.trim().toUpperCase();

  if (!type || !code) {
    throw new Error("recordType and businessCode are required.");
  }

  return `${type}::${code}`;
}
