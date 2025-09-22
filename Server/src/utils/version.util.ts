// Server/src/utils/version.util.ts
import { execFileSync } from 'node:child_process';

type Source = 'env' | 'render' | 'vercel' | 'git' | 'unknown';

export type VersionInfo = {
  sha: string | null;   // full 40-char if available
  short: string | null; // first 12 chars
  source: Source;
  buildTime: string;    // ISO
};

function tryGitRevParse(): string | null {
  const override = (process.env.GIT_BIN || '').trim();

  let candidates: string[];
  if (override) {
    candidates = [override];
  } else if (process.platform === 'win32') {
    candidates = [
      'C:\\Program Files\\Git\\bin\\git.exe',
      'C:\\Program Files\\Git\\cmd\\git.exe',
    ];
  } else {
    candidates = ['/usr/bin/git', '/usr/local/bin/git', '/bin/git'];
  }

  for (const bin of candidates) {
    try {
      const out = execFileSync(bin, ['rev-parse', 'HEAD'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
      if (out) return out;
    } catch {
      // try next candidate
    }
  }
  return null;
}


/** Detect commit SHA from common envs, else try a safe git invocation (no PATH). */
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

  const gitSha = tryGitRevParse();
  if (gitSha) {
    return { sha: gitSha, short: gitSha.slice(0, 12), source: 'git', buildTime };
  }

  return { sha: null, short: null, source: 'unknown', buildTime };
}

const CACHED = detect();

/** Use a cached, boot-time snapshot to avoid expensive calls per request. */
export function getVersionInfo(): VersionInfo {
  return CACHED;
}
