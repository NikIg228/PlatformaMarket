import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { postgresVerifyPort } from "./lib/postgres-verify-port.mjs";

test("PID-derived ports avoid fetch-blocked ports for every PID suffix", () => {
  for (let pid = 0; pid < 10000; pid++) {
    const port = postgresVerifyPort(undefined, pid);
    assert.ok(port >= 49152 && port <= 59151);
  }
  assert.equal(postgresVerifyPort("4400"), 4400);
  for (const port of ["5060", "5061", "6000", "6667", "10080", "NaN", "65536", "0", ""]) {
    assert.throws(() => postgresVerifyPort(port), /HTTP-safe/);
  }
});

test("HTTP readiness works for the PID suffix that formerly selected 5060", async () => {
  const server = createServer((_request, response) => response.end(JSON.stringify({ status: "ready" })));
  server.listen(postgresVerifyPort(undefined, 660), "127.0.0.1");
  try {
    await once(server, "listening");
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health/ready`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ready" });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
