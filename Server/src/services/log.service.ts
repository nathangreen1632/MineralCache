// Server/src/services/log.service.ts

/* Server/src/services/log.service.ts */

// JSON-line logger with safe redaction of PII / secrets.
// Keeps your original API: logInfo/logWarn/logError(event, fields?)

type Level = 'info' | 'warn' | 'error';
type Dict = Record<string, unknown>;

// ------------------------ Redaction helpers ------------------------

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

// Replace complex key-name regex with a simple list of hints
const SECRET_KEY_NAME_HINTS: RegExp[] = [
  /pass/i,
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /^authorization$/i,
  /^auth$/i,
  /cookie/i,
  /session/i,
  /^set-cookie$/i,
  /^x-api-key$/i,
  /stripe[_-]?(secret|sk)/i,
];

function isSecretKeyName(key: string): boolean {
  for (const re of SECRET_KEY_NAME_HINTS) {
    if (re.test(key)) return true;
  }
  return false;
}

// Replace complex “token-ish value” regex with a word list
const TOKENISH_WORDS = [
  'sk_live',
  'sk_test',
  'rk_live',
  'rk_test',
  'pk_live',
  'pk_test',
  'bearer',
  'secret',
  'token',
];

function containsTokenishWord(s: string): boolean {
  const low = s.toLowerCase();
  return TOKENISH_WORDS.some((w) => low.includes(w));
}

function maskEmail(s: string): string {
  return s.replace(EMAIL_RE, (m) => {
    const [name, domain] = m.split('@');
    const n = name.length <= 2 ? (name[0] || '*') : name.slice(0, 2) + '…';
    const d = domain.replace(/^[^.]+/, (frag) =>
      frag.length <= 2 ? (frag[0] || '*') : frag.slice(0, 2) + '…'
    );
    return `${n}@${d}`;
  });
}

function maskScalar(v: unknown): unknown {
  if (typeof v !== 'string') return v;

  // emails
  let s = maskEmail(v);

  // obvious tokens / secrets
  if (containsTokenishWord(s)) return '***';

  // long id/secret-ish strings (hex/base64-ish)
  if (s.length >= 40 && /^[A-Za-z0-9._\-+/=]+$/.test(s)) {
    return s.slice(0, 6) + '…REDACTED';
  }

  return s;
}

function redact(input: unknown, depth = 4): unknown {
  if (depth <= 0 || input == null) return input;

  if (Array.isArray(input)) {
    return input.map((x) => redact(x, depth - 1));
  }

  if (typeof input === 'object') {
    const out: Dict = {};
    for (const [k, v] of Object.entries(input as Dict)) {
      if (isSecretKeyName(k)) {
        out[k] = '***';
      } else if (typeof v === 'object' && v !== null) {
        out[k] = redact(v, depth - 1);
      } else {
        out[k] = maskScalar(v);
      }
    }
    return out;
  }

  return maskScalar(input);
}

// ------------------------ Core emit ------------------------

function emit(level: Level, event: string, fields: Dict = {}) {
  const safeFields = ((): Dict => {
    try {
      return redact(fields) as Dict;
    } catch {
      return { _redactError: true };
    }
  })();

  const entry = { ts: new Date().toISOString(), level, event, ...safeFields };

  // Single-line JSON to stdout
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

// ------------------------ Public API (backward compatible) ------------------------

export const logInfo = (event: string, fields?: Dict) => emit('info', event, fields);
export const logWarn = (event: string, fields?: Dict) => emit('warn', event, fields);
export const logError = (event: string, fields?: Dict) => emit('error', event, fields);

// ✅ NEW: named export expected by imports like `import { log } from '@/services/log.service'`
export const log = {
  info: logInfo,
  warn: logWarn,
  error: logError,
};
