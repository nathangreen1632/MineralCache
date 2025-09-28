// Tiny DOM-based event bus (no deps)
export function emit(event: string, detail?: unknown): void {
  const ev = new CustomEvent(event, { detail });
  window.dispatchEvent(ev);
}

export function on<T = unknown>(event: string, handler: (detail: T) => void): () => void {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<T>;
    handler(ce.detail);
  };
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}
