import { z } from "zod";

/** A proof for this session only. Never put this token in URLs or logs. */
export const sessionLogoutRequestSchema = z.object({
  sessionId: z.uuid(),
  accessToken: z.string().min(20).max(8192),
}).strict();
export const sessionLogoutResponseSchema = z.object({
  sessionId: z.uuid(),
  status: z.enum(["REVOKED", "EXPIRED"]),
  loginStatus: z.enum(["REVOKED", "EXPIRED", "NOT_LINKED", "SAME_SESSION"]),
}).strict();
export type SessionLogoutRequest = z.infer<typeof sessionLogoutRequestSchema>;
export type SessionLogoutResponse = z.infer<typeof sessionLogoutResponseSchema>;
