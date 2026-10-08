import assert from "node:assert/strict";
import test from "node:test";
import proxyaddr from "proxy-addr";
import sharp from "sharp";
import sourceMap from "source-map-js";

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
