import { traceExporterUrl } from "./platform/observability/otlp-endpoint";
import { environment } from "./platform/config/environment";

const config = environment();
const sentryDsn = config.SENTRY_DSN;
// This CommonJS entrypoint must finish instrumentation before Nest/app imports.
// Keep loads synchronous, but avoid loading disabled telemetry dependency graphs.
if (sentryDsn) {
  const Sentry = require("@sentry/nestjs") as typeof import("@sentry/nestjs");
  Sentry.init({ dsn: sentryDsn, environment: config.NODE_ENV, release: process.env.APP_RELEASE, tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"), sendDefaultPii: false });
}

const otlpEndpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;
if (otlpEndpoint) {
  const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node") as typeof import("@opentelemetry/auto-instrumentations-node");
  const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http") as typeof import("@opentelemetry/exporter-trace-otlp-http");
  const { NodeSDK } = require("@opentelemetry/sdk-node") as typeof import("@opentelemetry/sdk-node");
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "marketplace-api",
    traceExporter: new OTLPTraceExporter({ url: traceExporterUrl(otlpEndpoint) }),
    instrumentations: [getNodeAutoInstrumentations({ "@opentelemetry/instrumentation-fs": { enabled: false } })],
  });
  sdk.start();
  process.once("SIGTERM", () => { void sdk.shutdown(); });
}
