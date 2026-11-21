import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import proxyaddr from "proxy-addr";
import sharp from "sharp";
import sourceMap from "source-map-js";

function runDependencyProbe(source, env = {}) {
  const result = spawnSync(process.execPath, ["--input-type=commonjs", "-e", source], {
    cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 10_000,
    env: { ...process.env, ...env },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("Effect template literals reject adversarial inputs without blocking and retain valid matches", () => {
  // GHSA-7589-6fvf-x4pw: bound the child so a regression cannot hang the test runner.
  runDependencyProbe(`
    const assert = require('node:assert/strict');
    const { Schema } = require('effect');
    const schema = Schema.TemplateLiteral(Schema.String, ':', Schema.String, ':', Schema.String, 'X');
    const valid = Schema.is(schema);
    assert.equal(valid('clinic:order:itemX'), true);
    assert.equal(Schema.decodeUnknownSync(schema)('clinic:order:itemX'), 'clinic:order:itemX');
    for (const input of [':'.repeat(10000), 'a:'.repeat(5000)]) {
      assert.equal(valid(input), false);
      assert.throws(() => Schema.decodeUnknownSync(schema)(input));
    }
  `);
});

test("HTTP server spans redact signed URL credentials and retain ordinary query parameters", () => {
  // GHSA-3v2p-hm54-8qcq: exercise auto-instrumentation with a loopback request, no collector.
  runDependencyProbe(`
    const assert = require('node:assert/strict');
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { InMemorySpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
    const exporter = new InMemorySpanExporter();
    const processor = new SimpleSpanProcessor(exporter);
    const sdk = new NodeSDK({ autoDetectResources: false, spanProcessors: [processor],
      instrumentations: [getNodeAutoInstrumentations({ '@opentelemetry/instrumentation-fs': { enabled: false } })] });
    sdk.start();
    const http = require('node:http');
    const server = http.createServer((_req, res) => res.end('ok'));
    (async () => {
      try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        for (const query of ['X-Amz-Signature=private-aws&page=2', 'sig=private-azure&page=2']) {
          const body = await new Promise((resolve, reject) => {
            http.get('http://127.0.0.1:' + server.address().port + '/probe?' + query, res => {
              assert.equal(res.statusCode, 200);
              let body = ''; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve(body));
            }).on('error', reject);
          });
          assert.equal(body, 'ok');
        }
        await processor.forceFlush();
        const spans = exporter.getFinishedSpans().filter(span => span.kind === 1);
        assert.equal(spans.length, 2);
        for (const span of spans) {
          assert.match(span.attributes['url.query'], /page=2/);
          assert.doesNotMatch(JSON.stringify(span.attributes), /private-aws|private-azure/);
        }
      } finally {
        await new Promise(resolve => server.close(resolve));
        await sdk.shutdown();
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, { OTEL_SEMCONV_STABILITY_OPT_IN: "http", OTEL_METRICS_EXPORTER: "none", OTEL_LOGS_EXPORTER: "none" });
});

test("proxy trust rejects broad mapped IPv6 subnets without losing valid forwarded IPs", () => {
  const request = remoteAddress => ({ socket: { remoteAddress }, headers: { "x-forwarded-for": "198.51.100.20" } });
  for (const address of ["203.0.113.10", "::ffff:203.0.113.10"]) {
    assert.equal(proxyaddr(request(address), proxyaddr.compile("::ffff:10.0.0.0/8")), address);
  }
  assert.equal(proxyaddr(request("10.0.0.10"), proxyaddr.compile("::ffff:10.0.0.0/104")), "198.51.100.20");
  assert.equal(proxyaddr(request("127.0.0.1"), (_address, hop) => hop < 1), "198.51.100.20");
});

test("indexed source maps reject unbounded offsets and retain ordinary CSS positions", () => {
  const map = { version: 3, sources: ["input.css"], names: [], mappings: "AAAA" };
  for (const line of [Number.MAX_SAFE_INTEGER, Infinity, -1, 0.5]) {
    assert.throws(() => new sourceMap.SourceMapConsumer({ version: 3,
      sections: [{ offset: { line, column: 0 }, map }] }), /offset/i);
  }
  const consumer = new sourceMap.SourceMapConsumer({ version: 3,
    sections: [{ offset: { line: 0, column: 0 }, map }] });
  assert.deepEqual(consumer.originalPositionFor({ line: 1, column: 1 }), {
    source: "input.css", line: 1, column: 0, name: null,
  });
});

test("native image pipeline uses patched librsvg and preserves WebP normalization", async () => {
  // GHSA-wq5f-xc86-pv6w: verify the loaded native binary, not just package-lock.
  const [major, minor, patch] = sharp.versions.rsvg.split(".").map(Number);
  assert(major > 2 || (major === 2 && (minor > 63 || (minor === 63 && patch >= 2))));
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#198754"/></svg>');
  const { data, info } = await sharp(svg).rotate()
    .resize(1200, 1200, { fit: "contain", background: "#F7F8FA" })
    .webp({ quality: 86, effort: 4 }).toBuffer({ resolveWithObject: true });
  assert.equal(info.format, "webp");
  assert.equal(info.width, 1200);
  assert.equal(info.height, 1200);
  const decoded = await sharp(data).metadata();
  assert.equal(decoded.width, 1200);
  assert.equal(decoded.height, 1200);
});
