// Client/src/lib/api.ts

type ApiResult<T> = { data: T | null; error: string | null; status: number };

function isFormData(v: unknown): v is FormData {
  return typeof FormData !== 'undefined' && v instanceof FormData;
}
function isBlob(v: unknown): v is Blob {
  return typeof Blob !== 'undefined' && v instanceof Blob;
}
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const init: RequestInit = { credentials: 'include', ...options };

    // Headers: preserve caller's headers but ensure JSON when sending plain objects
    const headers = new Headers(init.headers || undefined);

    // Auto-stringify if body is a plain object (not FormData/Blob/string)
    if (init.body !== undefined && !isFormData(init.body) && !isBlob(init.body) && typeof init.body !== 'string') {
      if (isPlainObject(init.body)) {
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        init.body = JSON.stringify(init.body);
      }
    }

    // Default JSON header for requests with a body if caller didn't override
    if (init.body != null && !headers.has('Content-Type') && !isFormData(init.body) && !isBlob(init.body)) {
      headers.set('Content-Type', 'application/json');
    }
    init.headers = headers;

    const res = await fetch(`/api${path}`, init);
    const status = res.status;

    // 204/205: no content
    if (status === 204 || status === 205) {
      return res.ok
        ? { data: null, error: null, status }
        : { data: null, error: `HTTP ${status}`, status };
    }

    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');

    // Try to parse JSON if declared; otherwise fall back to text
    if (isJson) {
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        // If server lied about JSON, treat as unexpected payload
        return { data: null, error: `Unexpected ${status}`, status };
      }

      if (res.ok) {
        return { data: body as T, error: null, status };
      }

      // Extract the most helpful error field
      const msg =
        (typeof body?.error === 'string' && body.error) ||
        (typeof body?.message === 'string' && body.message) ||
        `HTTP ${status}`;
      return { data: null, error: msg, status };
    } else {
      // Non-JSON response
      const text = await res.text();
      if (res.ok) {
        // allow text responses as data (caller can type T=string when needed)
        return { data: (text as unknown as T), error: null, status };
      }
      const msg = text?.trim().length ? text.trim() : `HTTP ${status}`;
      return { data: null, error: msg, status };
    }
  } catch (e: any) {
    return { data: null, error: e?.message || 'Network error', status: 0 };
  }
}
