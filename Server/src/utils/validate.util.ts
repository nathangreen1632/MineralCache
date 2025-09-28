export function validateDefinedNumber(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} must be a finite number`);
  }
  return Math.trunc(n);
}
