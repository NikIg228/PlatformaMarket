import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express, { type ErrorRequestHandler, type Request } from "express";
import { request as httpRequest, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { AVATAR_MAX_BYTES, AVATAR_MAX_JSON_BYTES, DOCUMENT_UPLOAD_MAX_BYTES, IMPORT_UPLOAD_MAX_BYTES } from "@marketplace/schemas";
import { DEFAULT_JSON_MAX_BYTES, DOCUMENT_JSON_MAX_BYTES, IMPORT_JSON_MAX_BYTES, marketplaceBodyParser, requestBodyPolicy } from "./request-body-policy";
import { toApiErrorResponse } from "./api-exception.filter";

describe("HTTP request body resource boundary", () => {
  let server: Server;
  let port: number;
  beforeAll(async () => {
    const app = express();
    app.use(marketplaceBodyParser());
    app.use((req, res) => {
      const raw = (req as Request & { rawBody?: Buffer }).rawBody;
      res.json({ length: req.body?.contentBase64?.length, rawHash: raw ? createHash("sha256").update(raw).digest("hex") : null });
    });
    app.use(((error, req, res, _next) => {
      const body = toApiErrorResponse(error, { path: req.originalUrl, requestId: "payload-test", production: true });
      res.status(body.statusCode).json(body);
    }) as ErrorRequestHandler);
    server = await new Promise<Server>((resolve) => { const listening = app.listen(0, "127.0.0.1", () => resolve(listening)); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    port = address.port;
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  function send(path: string, body: string | Buffer, options: { chunked?: boolean; encoding?: string; method?: string; contentType?: string } = {}) {
    return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const req = httpRequest({ host: "127.0.0.1", port, path, method: options.method ?? "POST", headers: {
        "content-type": options.contentType ?? "application/json",
        ...(options.chunked ? {} : { "content-length": Buffer.byteLength(body) }),
        ...(options.encoding ? { "content-encoding": options.encoding } : {}),
      } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }));
        res.on("error", reject);
      });
      req.on("error", reject);
      if (options.chunked) { req.write(body); req.end(); } else req.end(body);
    });
  }

  it("grants large limits only to upload POST routes, including Express case/trailing slash matching", () => {
    expect(requestBodyPolicy("POST", "/API/DOCUMENTS/UPLOAD/").limit).toBe(DOCUMENT_JSON_MAX_BYTES);
    expect(requestBodyPolicy("POST", "/API/SUPPORT/ATTACHMENTS/").limit).toBe(DOCUMENT_JSON_MAX_BYTES);
    expect(requestBodyPolicy("POST", "/api/support/attachments/other").limit).toBe(DEFAULT_JSON_MAX_BYTES);
    expect(requestBodyPolicy("PATCH", "/api/support/attachments").limit).toBe(DEFAULT_JSON_MAX_BYTES);
    expect(requestBodyPolicy("POST", "/api/compliance/organizations/org/credentials").limit).toBe(DOCUMENT_JSON_MAX_BYTES);
    expect(requestBodyPolicy("POST", "/api/suppliers/org/import-batches").limit).toBe(IMPORT_JSON_MAX_BYTES);
    for (const path of ["/api/documents/upload/extra", "/api/documents/uploaded", "/api/suppliers/org/import-batches/id/process"]) {
      expect(requestBodyPolicy("POST", path).limit).toBe(DEFAULT_JSON_MAX_BYTES);
    }
    expect(requestBodyPolicy("PATCH", "/api/documents/upload").limit).toBe(DEFAULT_JSON_MAX_BYTES);
  });

  it.each([false, true])("rejects oversized ordinary JSON with a safe 413 (chunked=%s)", async (chunked) => {
    const result = await send("/api/auth/login", JSON.stringify({ secret: "private-marker", contentBase64: "A".repeat(DEFAULT_JSON_MAX_BYTES) }), { chunked });
    expect(result.status).toBe(413);
    expect(result.body).toMatchObject({ code: "PAYLOAD_TOO_LARGE", requestId: "payload-test", path: "/api/auth/login" });
    expect(JSON.stringify(result.body)).not.toContain("private-marker");
  });

  it.each([
    ["/api/auth/profile/avatar", AVATAR_MAX_BYTES],
    ["/api/documents/upload", DOCUMENT_UPLOAD_MAX_BYTES],
    ["/api/support/attachments", DOCUMENT_UPLOAD_MAX_BYTES],
    ["/api/compliance/organizations/org/credentials", DOCUMENT_UPLOAD_MAX_BYTES],
    ["/api/suppliers/org/import-batches", IMPORT_UPLOAD_MAX_BYTES],
  ] as const)("accepts a maximum legitimate upload at %s", async (path, maxBytes) => {
    const contentBase64 = Buffer.alloc(maxBytes, 65).toString("base64");
    const result = await send(path, JSON.stringify({ fileName: "test.pdf", contentBase64 }));
    expect(result.status).toBe(200);
    expect(result.body.length).toBe(contentBase64.length);
    expect(result.body.rawHash).toBeNull();
  });

  it("bounds decompressed JSON and maps malformed JSON without reflecting it", async () => {
    expect((await send("/api/auth/profile/avatar", JSON.stringify({ contentBase64: "A".repeat(AVATAR_MAX_JSON_BYTES) }), { chunked: true })).status).toBe(413);
    const compressed = gzipSync(JSON.stringify({ contentBase64: "A".repeat(DEFAULT_JSON_MAX_BYTES) }));
    expect((await send("/api/auth/login", compressed, { encoding: "gzip" })).status).toBe(413);
    const invalid = await send("/api/auth/login", '{"secret":"private-marker",');
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ code: "BAD_REQUEST", message: "Invalid request body" });
    expect(JSON.stringify(invalid.body)).not.toContain("private-marker");
  });

  it.each(["/api/integrations/webhooks/endpoint", "/api/payments/webhooks/provider", "/api/documents/signatures/callback"])("preserves exact signed bytes and the 1 MiB bound for %s", async (path) => {
    const raw = '{ "event": "Принято", "nested" : [1, 2] }\n';
    const result = await send(path, raw, { chunked: true });
    expect(result.status).toBe(200);
    expect(result.body.rawHash).toBe(createHash("sha256").update(raw).digest("hex"));
    expect((await send(path, JSON.stringify({ body: "A".repeat(DEFAULT_JSON_MAX_BYTES) }), { chunked: true })).status).toBe(413);
  });

  it("keeps form bodies bounded on upload routes too", async () => {
    expect((await send("/api/documents/upload", `content=${"A".repeat(DEFAULT_JSON_MAX_BYTES)}`, { contentType: "application/x-www-form-urlencoded", chunked: true })).status).toBe(413);
  });
});
