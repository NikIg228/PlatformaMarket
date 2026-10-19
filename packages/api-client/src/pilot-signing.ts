import { z } from "zod";
import {
  pilotSigningHttpSchemas, pilotSigningOperations,
  type PilotSigningOperationName, type PilotSigningPathParams,
  type PilotSigningRequest, type PilotSigningResponse,
} from "@marketplace/schemas";
import type { MarketplaceApiClient } from "./index";

/** R7.6.1.3 contract client. Not connected to UI until the server flow is accepted. */
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
