// Client/src/lib/api.ts
export async function api<T>(path: string, options?: RequestInit): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options,
    });
    const status = res.status;
    const isJson = res.headers.get('content-type')?.includes('application/json') === true;
    if (!isJson) {
      return { data: null, error: `Unexpected ${status}`, status };
    }
    const body = await res.json();
    if (res.ok) {
      return { data: body as T, error: null, status };
    }
    const msg = typeof (body)?.error === 'string' ? (body).error : `HTTP ${status}`;
    return { data: null, error: msg, status };
  } catch (e: any) {
    return { data: null, error: e?.message || 'Network error', status: 0 };
  }
}
