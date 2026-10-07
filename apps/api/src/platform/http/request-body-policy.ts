import { HttpException } from "@nestjs/common";
import { AVATAR_MAX_JSON_BYTES, DOCUMENT_UPLOAD_MAX_JSON_BYTES, IMPORT_UPLOAD_MAX_JSON_BYTES } from "@marketplace/schemas";
import express, { type Request, type RequestHandler } from "express";
import { WEBHOOK_MAX_BODY_BYTES } from "../../modules/integrations/integration-webhooks.constants";

export const DEFAULT_JSON_MAX_BYTES = 1_048_576;
export const DOCUMENT_JSON_MAX_BYTES = DOCUMENT_UPLOAD_MAX_JSON_BYTES;
export const IMPORT_JSON_MAX_BYTES = IMPORT_UPLOAD_MAX_JSON_BYTES;

export function requestBodyPolicy(method: string, path: string) {
  const rawBody = /^\/api\/(?:integrations\/webhooks|payments\/webhooks|documents\/signatures\/callback)(?:\/|$)/i.test(path);
  if (rawBody) return { limit: WEBHOOK_MAX_BODY_BYTES, rawBody };
  if (method === "POST") {
    if (/^\/api\/auth\/profile\/avatar\/?$/i.test(path)) return { limit: AVATAR_MAX_JSON_BYTES, rawBody };
    if (/^\/api\/documents\/upload\/?$/i.test(path) || /^\/api\/support\/attachments\/?$/i.test(path) || /^\/api\/compliance\/organizations\/[^/]+\/credentials\/?$/i.test(path)) {
      return { limit: DOCUMENT_JSON_MAX_BYTES, rawBody };
    }
    if (/^\/api\/suppliers\/[^/]+\/import-batches\/?$/i.test(path)) return { limit: IMPORT_JSON_MAX_BYTES, rawBody };
  }
  return { limit: DEFAULT_JSON_MAX_BYTES, rawBody };
}

function safeParserError(error: unknown): HttpException {
  const type = error && typeof error === "object" && "type" in error ? error.type : undefined;
  if (type === "entity.too.large" || type === "parameters.too.many") return new HttpException("Request body exceeds the allowed byte limit", 413);
  if (type === "encoding.unsupported" || type === "charset.unsupported") return new HttpException("Unsupported request body encoding", 415);
  // Parser errors can carry the submitted body and fragments of invalid JSON.
  return new HttpException("Invalid request body", 400);
}

export function marketplaceBodyParser(): RequestHandler {
  const parsers = new Map<string, RequestHandler>();
  const formParser = express.urlencoded({ limit: DEFAULT_JSON_MAX_BYTES, extended: true, parameterLimit: 1_000 });
  return (request, response, next) => {
    const policy = requestBodyPolicy(request.method, request.path);
    const contentLength = request.headers["content-length"];
    if (contentLength !== undefined && Number(contentLength) > policy.limit) {
      next(new HttpException("Request body exceeds the allowed byte limit", 413));
      return;
    }
    const key = `${policy.limit}:${policy.rawBody}`;
    let parser = parsers.get(key);
    if (!parser) {
      parser = express.json({
        limit: policy.limit,
        ...(policy.rawBody ? { verify: (req: Request, _res: unknown, buffer: Buffer) => { (req as Request & { rawBody?: Buffer }).rawBody = buffer; } } : {}),
      });
      parsers.set(key, parser);
    }
    parser(request, response, (error?: unknown) => {
      if (error) { next(safeParserError(error)); return; }
      formParser(request, response, (formError?: unknown) => next(formError ? safeParserError(formError) : undefined));
    });
  };
}
