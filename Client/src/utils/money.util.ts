const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function centsToUsd(cents?: number | null): string {
  const n = typeof cents === 'number' ? Math.trunc(cents) : 0;
  return usdFmt.format(n / 100);
}
