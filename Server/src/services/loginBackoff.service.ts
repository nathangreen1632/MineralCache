// Server/src/services/loginBackoff.service.ts
/* ESM + TS, NodeNext */
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LADDER_SECONDS = [0, 2, 5, 10, 30] as const; // 1/2/3/4/5+ failures

/** Value: sorted (ascending) list of failure timestamps (ms) within window */
const store = new Map<string, number[]>();

function nowMs(): number {
  return Date.now();
}

function keyFor(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}|${ip}`;
}

function purgeOld(ts: number[]): number[] {
  const cutoff = nowMs() - WINDOW_MS;
  // ts is already small; linear filter suffices
  return ts.filter((t) => t >= cutoff);
}

function backoffSecondsForCount(failureCount: number): number {
  if (failureCount <= 0) return 0;
  const idx = Math.min(failureCount, LADDER_SECONDS.length) - 1;
  return LADDER_SECONDS[idx];
}

export function shouldThrottle(email: string, ip: string): {
  blocked: boolean;
  retryAfterSec: number;
  failuresInWindow: number;
  lastFailureAt?: number;
} {
  const k = keyFor(email, ip);
  const list = purgeOld(store.get(k) ?? []);
  if (list.length !== (store.get(k)?.length ?? 0)) {
    store.set(k, list);
  }

  if (list.length === 0) {
    return { blocked: false, retryAfterSec: 0, failuresInWindow: 0 };
  }

  const failuresInWindow = list.length;
  const lastFailureAt = list[list.length - 1];
  const waitSec = backoffSecondsForCount(failuresInWindow);
  const allowedAt = lastFailureAt + waitSec * 1000;

  if (nowMs() < allowedAt) {
    const retryAfterSec = Math.ceil((allowedAt - nowMs()) / 1000);
    return { blocked: true, retryAfterSec, failuresInWindow, lastFailureAt };
  }
  return { blocked: false, retryAfterSec: 0, failuresInWindow, lastFailureAt };
}

export function recordLoginFailure(email: string, ip: string): void {
  const k = keyFor(email, ip);
  const list = purgeOld(store.get(k) ?? []);
  list.push(nowMs());
  store.set(k, list);
}

export function clearLoginFailures(email: string, ip: string): void {
  const k = keyFor(email, ip);
  store.delete(k);
}

/** Optional: called on a timer if you want to prune the map occasionally */
export function sweepBackoffStore(): void {
  for (const [k, list] of store.entries()) {
    const next = purgeOld(list);
    if (next.length === 0) store.delete(k);
    else if (next.length !== list.length) store.set(k, next);
  }
}
