/** Retry transient read failures only. Never use this helper for mutations. */
export async function resilientGet(url: string, options: Omit<RequestInit, "method" | "body"> = {}) {
  const delays = [400, 1200];
  const signal = options.signal ?? undefined;
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      const response = await fetch(url, { ...options, method: "GET" });
      if (![500, 502, 503, 504].includes(response.status) || attempt === delays.length) return response;
      await response.body?.cancel();
    } catch (error) {
      if (signal?.aborted || attempt === delays.length || !(error instanceof TypeError)) throw error;
    }
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(signal?.reason); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, delays[attempt]);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
}
