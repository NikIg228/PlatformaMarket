import { z } from "zod";
import {
  pilotSigningHttpSchemas, pilotSigningOperations,
  type PilotSigningOperationName, type PilotSigningPathParams,
  type PilotSigningRequest, type PilotSigningResponse,
  DOCUMENT_UPLOAD_MAX_BYTES, type UploadDocumentInput,
} from "@marketplace/schemas";
import type { MarketplaceApiClient } from "./index";

/** Identity operations are used by the profile. Other pilot operations remain contracts until their server flow is implemented. */
export class PilotSigningApiClient {
  constructor(private readonly transport: Pick<MarketplaceApiClient, "request">) {}

  async call<K extends PilotSigningOperationName>(
    operation: K,
    params: PilotSigningPathParams<K>,
    ...args: PilotSigningRequest<K> extends undefined ? [] : [input: PilotSigningRequest<K>]
  ): Promise<PilotSigningResponse<K>> {
    const spec = pilotSigningOperations[operation];
    const names = [...spec.path.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
    const pathParams = params as Record<string, string>;
    if (Object.keys(pathParams).length !== names.length || names.some(name => !z.uuid().safeParse(pathParams[name]).success)) {
      throw new Error("Invalid signing path parameters");
    }
    let path: string = spec.path.replace(/\{([^}]+)\}/g, (_, name: string) => encodeURIComponent(pathParams[name]));
    const input = spec.request === null ? undefined : pilotSigningHttpSchemas[spec.request].parse(args[0]);
    const init: RequestInit = { method: spec.method };
    if (spec.method === "GET" && input !== undefined) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(input)) query.set(key, String(value));
      path += `?${query}`;
    } else if (input !== undefined) {
      init.body = JSON.stringify(input);
    }
    // No automatic re-sign, CMS retry or success inference after a network error.
    const response = await this.transport.request<unknown>(path, init);
    return pilotSigningHttpSchemas[spec.response].parse(response) as PilotSigningResponse<K>;
  }
}

/** Keeps the exact upload payload across a lost response. The archive's document
 * number replay contract prevents a retry from creating a second document. */
export class PilotEvidenceUpload {
  private prepared: { file: File; input: UploadDocumentInput; result?: { id: string; version: number } } | null = null;
  constructor(private readonly api: Pick<MarketplaceApiClient, "uploadDocument">, private readonly organizationId: string) {}
  async upload(file: File) {
    if (!file.size || file.size > DOCUMENT_UPLOAD_MAX_BYTES || !/\.(pdf|docx)$/i.test(file.name)) throw new Error("Выберите PDF или DOCX размером до 10 МБ.");
    if (this.prepared?.file !== file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      this.prepared = { file, input: { ownerOrganizationId: this.organizationId, kind: "OTHER", category: "OTHER",
        format: /\.pdf$/i.test(file.name) ? "PDF" : "DOCX", title: file.name.slice(0, 240),
        documentNumber: `SIGNING-BASIS-${crypto.randomUUID()}`, fileName: file.name, contentBase64: btoa(binary), requiredSignatureCount: 0 } };
    }
    if (!this.prepared.result) {
      const result = await this.api.uploadDocument(this.prepared.input);
      this.prepared.result = z.object({ id: z.uuid(), version: z.number().int().positive() }).parse(result);
    }
    return this.prepared.result;
  }
}

export function pilotSigningErrorCode(error: unknown): string | null {
  const payload = error && typeof error === "object" && "payload" in error ? error.payload : null;
  return payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string" ? payload.code : null;
}
export function pilotSigningOutcomeUnknown(error: unknown) {
  return !(error && typeof error === "object" && "status" in error && typeof error.status === "number" && error.status >= 400 && error.status < 500);
}
