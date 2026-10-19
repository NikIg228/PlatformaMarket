import { z } from "zod";
import { pilotSigningHttpSchemas, pilotSigningHttpStatus, pilotSigningOperations } from "./pilot-signing-http.js";

/** Standalone design artifact. Never merge these unimplemented routes into runtime Swagger. */
export function createPilotSigningOpenApi() {
  const schemas = Object.fromEntries(Object.entries(pilotSigningHttpSchemas).map(([name, schema]) => {
    const json = z.toJSONSchema(schema, { target: "draft-2020-12" });
    // OpenAPI 3.1 supplies its JSON Schema dialect at document level.
    const { $schema: _dialect, ...definition } = json;
    return [name, definition];
  }));
  const reference = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [operationId, spec] of Object.entries(pilotSigningOperations)) {
    const parameters: unknown[] = [...spec.path.matchAll(/\{([^}]+)\}/g)].map(match => ({
      name: match[1], in: "path", required: true, schema: { type: "string", format: "uuid" },
    }));
    if (spec.method === "GET" && spec.request !== null) {
      const query = schemas[spec.request] as { properties?: Record<string, unknown>; required?: string[] };
      for (const [name, schema] of Object.entries(query.properties ?? {})) {
        parameters.push({ name, in: "query", required: query.required?.includes(name) ?? false, schema });
      }
    }
    const responses: Record<string, unknown> = {
      [spec.status]: { description: "Versioned resource; inspect status before treating an action as committed",
        content: { "application/json": { schema: reference(spec.response) } } },
    };
    for (const status of new Set(Object.values(pilotSigningHttpStatus))) {
      responses[status] = { description: "Safe core error envelope; domain code determines recovery",
        content: { "application/json": { schema: reference("Error") } } };
    }
    paths[spec.path] ??= {};
    paths[spec.path][spec.method.toLowerCase()] = {
      operationId, "x-implementation-status": "CONTRACT_ONLY", "x-access-policy": spec.access,
      security: [{ bearerAuth: [] }], parameters, responses,
      ...(spec.method === "POST" && spec.request !== null ? {
        requestBody: { required: true, content: { "application/json": { schema: reference(spec.request) } } },
      } : {}),
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: "Platforma Market pilot signing contract", version: "0.1.0",
      description: "R7.6.1.3 CONTRACT_ONLY. No live routes. Cross-field, authorization and crypto invariants require server enforcement; see MARKET_DOCUMENT_WORKFLOW §18.6–18.8." },
    "x-implementation-status": "CONTRACT_ONLY",
    paths, components: { schemas, securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
  };
}
