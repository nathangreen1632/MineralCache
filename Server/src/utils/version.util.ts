// Server/src/utils/version.util.ts
import { execSync } from 'node:child_process';

type Source = 'env' | 'render' | 'vercel' | 'git' | 'unknown';

export type VersionInfo = {
  sha: string | null;      // full 40-char if available
  short: string | null;    // first 12 chars
  source: Source;
  buildTime: string;       // ISO
};

/** Detect commit SHA from common envs, else try `git rev-parse`. */
function detect(): VersionInfo {
  const buildTime = new Date().toISOString();

  const envOrder: Array<{ key: string; source: Source }> = [
    { key: 'GIT_SHA', source: 'env' },
    { key: 'RENDER_GIT_COMMIT', source: 'render' },
    { key: 'VERCEL_GIT_COMMIT_SHA', source: 'vercel' },
    { key: 'COMMIT_SHA', source: 'env' },
  ];

  for (const { key, source } of envOrder) {
    const v = (process.env[key] || '').trim();
    if (v) return { sha: v, short: v.slice(0, 12), source, buildTime };
  }

  try {
    const out = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (out) return { sha: out, short: out.slice(0, 12), source: 'git', buildTime };
  } catch {
    // ignore — git not available in container
  }

  return { sha: null, short: null, source: 'unknown', buildTime };
}

const CACHED = detect();

/** Use a cached, boot-time snapshot to avoid expensive calls per request. */
export function getVersionInfo(): VersionInfo {
  return CACHED;
}
