import { randomUUID } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
import { requireExternalIntegrations } from "../../platform/config/limited-stand";

export type SignatureSessionRequest = {
  documentId: string;
  checksumSha256: string;
  method: "EDS" | "EGOV_QR" | "SIMPLE" | "EXTERNAL" | "MOCK";
  signerName?: string | null;
  expiresAt: Date;
};

export type SignatureSessionResult = { externalSessionId: string; signingUrl: string | null; status: "SESSION_CREATED" | "SIGNED"; evidence?: Record<string, unknown> };

export interface SignatureAdapter {
  createSession(request: SignatureSessionRequest): Promise<SignatureSessionResult>;
}

export class MockSignatureAdapter implements SignatureAdapter {
  async createSession(request: SignatureSessionRequest): Promise<SignatureSessionResult> {
    requireExternalIntegrations();
    if (process.env.NODE_ENV === "production" || !["MOCK", "SIMPLE"].includes(request.method)) {
      throw new ServiceUnavailableException("Test adapter cannot perform a real document signature");
    }
    return { externalSessionId: `mock-sign-${randomUUID()}`, signingUrl: null, status: request.method === "SIMPLE" ? "SIGNED" : "SESSION_CREATED", evidence: { adapter: "mock", checksumSha256: request.checksumSha256 } };
  }
}

export class ConfiguredSignatureAdapter implements SignatureAdapter {
  constructor(private readonly gatewayUrl: string, private readonly gatewayToken?: string) {}

  async createSession(request: SignatureSessionRequest): Promise<SignatureSessionResult> {
    requireExternalIntegrations();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const payload = {
      documentId: request.documentId,
      checksumSha256: request.checksumSha256,
      method: request.method,
      signerName: request.signerName ?? undefined,
      expiresAt: request.expiresAt.toISOString(),
    };
    try {
      const response = await fetch(`${this.gatewayUrl.replace(/\/$/, "")}/sessions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(this.gatewayToken ? { Authorization: `Bearer ${this.gatewayToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let body: Record<string, unknown> = {};
      if (text) {
        try {
          const parsed = JSON.parse(text) as unknown;
          body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
        } catch {
          throw new Error("EDS gateway returned invalid JSON");
        }
      }
      if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : `EDS gateway returned HTTP ${response.status}`);
      const externalSessionId = typeof body.externalSessionId === "string" ? body.externalSessionId : typeof body.sessionId === "string" ? body.sessionId : undefined;
      if (!externalSessionId) throw new Error("EDS gateway response does not contain externalSessionId");
      const signingUrl = typeof body.signingUrl === "string" ? body.signingUrl : typeof body.url === "string" ? body.url : null;
      // Session creation is not verified signature evidence. Completion uses the
      // authenticated callback or server verification of the submitted CMS.
      return { externalSessionId, signingUrl, status: "SESSION_CREATED", evidence: { adapter: "configured-gateway", method: request.method } };
    } finally {
      clearTimeout(timer);
    }
  }
}
