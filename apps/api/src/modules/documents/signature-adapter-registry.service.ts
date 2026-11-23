import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { DocumentSignatureMethod } from "@prisma/client";
import { ConfiguredSignatureAdapter, MockSignatureAdapter } from "./signature-adapter";
import { isLimitedTestStand, requireExternalIntegrations } from "../../platform/config/limited-stand";

@Injectable()
export class SignatureAdapterRegistry {
  private readonly mock = new MockSignatureAdapter();
  resolve(method: DocumentSignatureMethod) {
    requireExternalIntegrations();
    if (["MOCK", "SIMPLE"].includes(method)) {
      if (process.env.NODE_ENV === "production") throw new ServiceUnavailableException("Test signature methods are unavailable in production");
      return this.mock;
    }
    const url = process.env.SIGNATURE_GATEWAY_URL;
    if (!url) throw new ServiceUnavailableException(`Signature method ${method} is configured but SIGNATURE_GATEWAY_URL is missing`);
    return new ConfiguredSignatureAdapter(url, process.env.SIGNATURE_GATEWAY_TOKEN);
  }

  capabilities() {
    if (isLimitedTestStand()) return { methods: [], configuredExternalGateway: false };
    const configuredExternalGateway = Boolean(process.env.SIGNATURE_GATEWAY_URL);
    return { methods: [...(process.env.NODE_ENV === "production" ? [] : ["MOCK", "SIMPLE"]), ...(configuredExternalGateway ? ["EDS", "EGOV_QR", "EXTERNAL"] : [])], configuredExternalGateway };
  }
}
