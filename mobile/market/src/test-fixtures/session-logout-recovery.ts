import { server, response, current, type Reply } from "./market-session";
export function logoutBackend(override?: (path: string, init: RequestInit) => Reply | Promise<Reply> | undefined) { return server((path,init)=>{const custom=override?.(path,init);if(custom)return custom;if(path==="/auth/current")return response(current());}); }
