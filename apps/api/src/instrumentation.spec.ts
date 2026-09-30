import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { describe, expect, it } from "vitest";

const compiled = Object.fromEntries(
  ["instrumentation", "app.module", "main", "worker-bootstrap"].map(name => [
    name,
    transpileModule(readFileSync(resolve(__dirname, `${name}.ts`), "utf8"), {
      compilerOptions: { module: ModuleKind.CommonJS, experimentalDecorators: true },
    }).outputText,
  ]),
);

function telemetry(config: Record<string, unknown>) {
  const loads: string[] = [];
  const events: string[] = [];
  const sentryOptions: unknown[] = [];
  const sdkOptions: unknown[] = [];
  const listeners: Record<string, () => void> = {};
  class SentryGlobalFilter {}
  const fakeProcess = { env: {}, once: (event: string, listener: () => void) => { listeners[event] = listener; } };
  const modules: Record<string, unknown> = {
    "./platform/config/environment": { environment: () => ({ NODE_ENV: "test", ...config }) },
    "./platform/observability/otlp-endpoint": { traceExporterUrl: (base: string) => `${base}/v1/traces` },
    "@sentry/nestjs": { init: (options: unknown) => { sentryOptions.push(options); events.push("sentry:init"); } },
    "@sentry/nestjs/setup": { SentryGlobalFilter },
    "@opentelemetry/auto-instrumentations-node": { getNodeAutoInstrumentations: (options: unknown) => ({ options }) },
    "@opentelemetry/exporter-trace-otlp-http": { OTLPTraceExporter: class { constructor(public options: unknown) {} } },
    "@opentelemetry/sdk-node": { NodeSDK: class {
      constructor(options: unknown) { sdkOptions.push(options); }
      start() { events.push("otel:start"); }
      async shutdown() { events.push("otel:shutdown"); }
    } },
  };
  const load = (id: string) => {
    loads.push(id);
    if (!(id in modules)) throw new Error(`Unexpected module ${id}`);
    return modules[id];
  };
  const execute = (name: string, requireModule = load) => {
    const exports = {};
    runInNewContext(compiled[name], { require: requireModule, exports, process: fakeProcess });
    return exports;
  };
  return { loads, events, sentryOptions, sdkOptions, listeners, modules, load, execute, SentryGlobalFilter };
}

describe("conditional telemetry loading", () => {
  it("does not load optional telemetry or install a shutdown hook when disabled", () => {
    const probe = telemetry({});
    probe.execute("instrumentation");
    expect(probe.loads.filter(id => id.startsWith("@"))).toEqual([]);
    expect(probe.events).toEqual([]);
    expect(probe.listeners).toEqual({});
  });

  it("loads and initializes only Sentry when its DSN is configured", () => {
    const probe = telemetry({ SENTRY_DSN: "https://public@example.invalid/1" });
    probe.execute("instrumentation");
    expect(probe.loads.filter(id => id.startsWith("@"))).toEqual(["@sentry/nestjs"]);
    expect(probe.sentryOptions).toEqual([expect.objectContaining({ dsn: "https://public@example.invalid/1", environment: "test", sendDefaultPii: false, tracesSampleRate: 0.1 })]);
    expect(probe.events).toEqual(["sentry:init"]);
  });

  it("starts OTEL with its exporter and preserves shutdown without loading Sentry", () => {
    const probe = telemetry({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.example.invalid" });
    probe.execute("instrumentation");
    expect(probe.loads.some(id => id.startsWith("@sentry"))).toBe(false);
    expect(probe.sdkOptions).toEqual([expect.objectContaining({
      serviceName: "marketplace-api",
      traceExporter: expect.objectContaining({ options: { url: "https://collector.example.invalid/v1/traces" } }),
      instrumentations: [{ options: { "@opentelemetry/instrumentation-fs": { enabled: false } } }],
    })]);
    expect(probe.events).toEqual(["otel:start"]);
    probe.listeners.SIGTERM();
    expect(probe.events).toEqual(["otel:start", "otel:shutdown"]);
  });

  it.each(["main", "worker-bootstrap"])("initializes both SDKs before %s loads the application", async entry => {
    const probe = telemetry({ SENTRY_DSN: "https://public@example.invalid/1", OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.example.invalid" });
    let applicationImported = false;
    probe.execute(entry, id => {
      if (id === "./instrumentation") { probe.execute("instrumentation"); return {}; }
      if (id === "./bootstrap" || id === "./app.module") {
        expect(probe.events).toEqual(["sentry:init", "otel:start"]);
        applicationImported = true;
        return { createMarketplaceApp: async () => ({ listen: async () => undefined }), AppModule: class {} };
      }
      if (id === "./platform/config/environment") return probe.load(id);
      if (id === "./platform/runtime/process-role") return { runtimeCapabilities: () => ({ http: true }) };
      return {};
    });
    await Promise.resolve();
    expect(applicationImported).toBe(true);
  });

  it.each([false, true])("registers the Sentry filter only when enabled=%s", enabled => {
    const probe = telemetry(enabled ? { SENTRY_DSN: "https://public@example.invalid/1" } : {});
    let providers: Array<{ provide?: string; useClass?: unknown }> = [];
    probe.execute("app.module", id => {
      if (id === "./platform/config/environment" || id.startsWith("@sentry")) return probe.load(id);
      if (id === "@nestjs/common") return { Module: (metadata: { providers: typeof providers }) => { providers = metadata.providers; return () => undefined; } };
      if (id === "@nestjs/core") return { APP_FILTER: "APP_FILTER", APP_GUARD: "APP_GUARD" };
      if (id === "@nestjs/throttler") return { ThrottlerModule: { forRoot: () => ({}) } };
      if (id === "./platform/security/rate-limit.storage") return { RedisThrottlerStorage: class {} };
      if (id === "./platform/runtime/process-role") return { runtimeCapabilities: () => ({ schedules: false }) };
      if (id === "./platform/runtime/deployment-profile.modules") return { deploymentProfileModules: () => [] };
      return {};
    });
    expect(probe.loads.includes("@sentry/nestjs/setup")).toBe(enabled);
    expect(providers.filter(provider => provider?.provide === "APP_FILTER")).toEqual(enabled ? [{ provide: "APP_FILTER", useClass: probe.SentryGlobalFilter }] : []);
  });
});
