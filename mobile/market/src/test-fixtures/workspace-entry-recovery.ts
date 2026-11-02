import { server, response, type Reply } from "./market-session";
export function workspaceBackend(override?: (path: string, init: RequestInit) => Reply | Promise<Reply> | undefined) {
  return server((path,init) => { const custom=override?.(path,init); if(custom) return custom; if(path.startsWith("/auth/current"))return response(null); });
}
