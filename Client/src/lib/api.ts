import { type ApiResult, type ApiInit } from "../types/api.types.ts";

function isFormData(v: unknown): v is FormData {
  return typeof FormData !== 'undefined' && v instanceof FormData;
}
function isBlob(v: unknown): v is Blob {
  return typeof Blob !== 'undefined' && v instanceof Blob;
}
function isURLSearchParams(v: unknown): v is URLSearchParams {
  return typeof URLSearchParams !== 'undefined' && v instanceof URLSearchParams;
}
function isReadableStream(v: unknown): v is ReadableStream {
  return typeof ReadableStream !== 'undefined' && v instanceof ReadableStream;
}
function isArrayBufferLike(v: unknown): v is ArrayBuffer | ArrayBufferView {
  return v instanceof ArrayBuffer || ArrayBuffer.isView(v as any);
}
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    v != null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    !isFormData(v) &&
    !isBlob(v) &&
    !isURLSearchParams(v) &&
    !isReadableStream(v) &&
    !isArrayBufferLike(v)
  );
}

/** Prepare headers + body → safe RequestInit */
function prepareInit(options?: ApiInit): RequestInit {
  const headers = new Headers(options?.headers);
  let bodyOut: BodyInit | null | undefined;

  if (options && 'body' in options && options.body !== undefined) {
    const b = options.body;
    if (
      typeof b === 'string' ||
      isFormData(b) ||
      isBlob(b) ||
      isURLSearchParams(b) ||
      isReadableStream(b) ||
      isArrayBufferLike(b)
    ) {
      bodyOut = b as BodyInit;
    } else if (isPlainObject(b)) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      bodyOut = JSON.stringify(b);
    } else {
      // Unsupported body type -> let fetch handle (may error); don't force a type
      bodyOut = undefined;
    }
  }

  // Assume JSON for string bodies when no content type set
  if (typeof bodyOut === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const { body: _body, headers: _headers, ...rest } = options ?? {};
  return {
    credentials: 'include',
    ...rest,
    headers,
    body: bodyOut,
  };
}

export async function api<T>(path: string, options?: ApiInit): Promise<ApiResult<T>> {
  try {
    const init = prepareInit(options);
    const res = await fetch(`/api${path}`, init);
    const status = res.status;

    // No-content responses
    if (status === 204 || status === 205) {
      return res.ok ? { data: null, error: null, status } : { data: null, error: `HTTP ${status}`, status };
    }

    const ct = res.headers.get('content-type') || '';
    const isJson = ct.includes('application/json');

    if (!isJson) {
      // Non-JSON: fall back to text
      const text = await res.text();
      if (res.ok) return { data: (text as unknown as T), error: null, status };
      const msg = text?.trim().length ? text.trim() : `HTTP ${status}`;
      return { data: null, error: msg, status };
    }

    // JSON response
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      return { data: null, error: `Unexpected ${status}`, status };
    }
    if (res.ok) return { data: body as T, error: null, status };

    const msg =
      (typeof body?.error === 'string' && body.error) ||
      (typeof body?.message === 'string' && body.message) ||
      `HTTP ${status}`;
    return { data: null, error: msg, status };
  } catch (e: any) {
    return { data: null, error: e?.message || 'Network error', status: 0 };
  }
}

/* -----------------------
   Convenience wrappers
----------------------- */

// Re-export the result type if you want to import it elsewhere
export type { ApiResult };

// GET
export function get<R>(path: string, init?: Omit<ApiInit, 'method' | 'body'>) {
  return api<R>(path, { ...init, method: 'GET' });
}

// DELETE
export function del<R>(path: string, init?: Omit<ApiInit, 'method' | 'body'>) {
  return api<R>(path, { ...init, method: 'DELETE' });
}

// POST (accepts a typed body)
export function post<R, B = unknown>(
  path: string,
  body?: B,
  init?: Omit<ApiInit, 'method' | 'body'>
) {
  return api<R>(path, { ...init, method: 'POST', body });
}

// PATCH (accepts a typed body)
export function patch<R, B = unknown>(
  path: string,
  body?: B,
  init?: Omit<ApiInit, 'method' | 'body'>
) {
  return api<R>(path, { ...init, method: 'PATCH', body });
}
