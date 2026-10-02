import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { environment } from "./platform/config/environment";
import { jsonSafeReplacer } from "./platform/http/json-safe-replacer";
import {
  httpLoggerMiddleware,
  NestStructuredLogger,
} from "./platform/observability/structured-logger";
import { identityContextMiddleware } from "./platform/security/identity-context.middleware";
import { configureRuntimeSwagger } from "./platform/openapi/runtime-swagger";
import { ApiExceptionFilter } from "./platform/http/api-exception.filter";
import { runtimeCapabilities } from "./platform/runtime/process-role";
import { MetricsService } from "./platform/observability/metrics.service";
import { httpMetricsMiddleware } from "./platform/observability/metrics.middleware";
import { SessionRevocationService } from "./platform/security/session-revocation.service";
import { marketplaceBodyParser } from "./platform/http/request-body-policy";

export async function createMarketplaceApp(
  options: { serverless?: boolean } = {},
) {
  const config = environment();
  if (!runtimeCapabilities(config.PROCESS_ROLE).http) throw new Error("HTTP bootstrap is disabled for PROCESS_ROLE=worker");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    rawBody: true,
    logger: new NestStructuredLogger(),
  });
  if (!options.serverless) app.enableShutdownHooks();
  app.set("json replacer", jsonSafeReplacer);
  if (config.TRUST_PROXY) app.set("trust proxy", 1);
  const cspConnect = [
    "'self'",
    ...config.CORS_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          imgSrc: ["'self'", "data:"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          connectSrc: cspConnect,
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts:
        config.NODE_ENV === "production"
          ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
          : false,
    }),
  );
  app.use(identityContextMiddleware(app.get(SessionRevocationService)));
  app.use(httpLoggerMiddleware());
  app.use(httpMetricsMiddleware(app.get(MetricsService)));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix("api");
  const allowedOrigins = new Set(
    config.CORS_ORIGINS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  app.enableCors({
    origin: (origin, callback) =>
      callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    exposedHeaders: ["x-request-id"],
  });
  app.use(marketplaceBodyParser());
  configureRuntimeSwagger(app, config.NODE_ENV);
  return app;
}
