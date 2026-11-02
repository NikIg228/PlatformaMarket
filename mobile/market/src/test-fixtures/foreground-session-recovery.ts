import { server, type Reply } from "./market-session";
export const foregroundBackend = (override?: (path: string, init: RequestInit) => Reply | Promise<Reply> | undefined) => server(override);
