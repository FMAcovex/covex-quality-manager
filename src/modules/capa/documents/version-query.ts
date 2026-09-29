export function parseCapaAnnexVersion(value: string | null):
  | { valid: true; sequenceNumber: number | null }
  | { valid: false } {
  if (value === null) return { valid: true, sequenceNumber: null };
  if (!/^(0|[1-9]\d*)$/.test(value)) return { valid: false };
  const sequenceNumber = Number(value);
  return Number.isSafeInteger(sequenceNumber)
    ? { valid: true, sequenceNumber }
    : { valid: false };
}
