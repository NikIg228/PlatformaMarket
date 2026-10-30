/** Transport required by endpoint implementations. The public client owns auth/retry policy. */
export interface ClientTransport {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  get<T>(path: string, options?: Pick<RequestInit, "signal">): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  download(path: string): Promise<{ blob: Blob; fileName: string | null }>;
}
