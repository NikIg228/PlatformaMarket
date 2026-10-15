import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { NcalayerClient } from "../packages/eds-client/dist/index.js";

// An unsigned, synthetic packet only. Never contacts NCALayer or a verifier.
const output = new URL("../.tmp/nca-prototype/packet/", import.meta.url);
const original = Buffer.from("Platforma Market / NCA prototype v1\nTEST ONLY - NO COMMERCIAL OBLIGATIONS\nDocument: TEST-0001\nAmount: 0 KZT\n", "utf8");
const modified = Buffer.from(original); modified[0] ^= 1;
const sha256 = value => createHash("sha256").update(value).digest("hex");
let captured;
const client = new NcalayerClient({ allowedStorages: ["PKCS12"], webSocketFactory: () => {
  const socket = {
    onopen: null, onmessage: null, onerror: null, onclose: null,
    send(value) {
      captured = JSON.parse(value);
      queueMicrotask(() => socket.onmessage?.({ data: JSON.stringify({ status: false, code: "CAPTURE_ONLY", message: "Unsigned prototype request captured" }) }));
    },
    close() {},
  };
  queueMicrotask(() => socket.onopen?.());
  return socket;
} });
await assert.rejects(client.signCmsDetached(original), { code: "CAPTURE_ONLY" });
assert.equal(captured.module, "kz.gov.pki.knca.basics");
assert.equal(captured.args.format, "cms");
assert.deepEqual(captured.args.signingParams, { decode: true, encapsulate: false, digested: false, tsaProfile: {} });
assert.deepEqual(Buffer.from(captured.args.data, "base64"), original);
assert.notEqual(sha256(original), sha256(modified));
const scenarios = [
  "original-detached-cms", "modified-byte-rejected", "wrong-organization-rejected",
  "expired-certificate-rejected", "revoked-certificate-rejected", "untrusted-chain-rejected",
  "revocation-unavailable-or-stale", "timestamp-validity", "user-cancel", "unknown-outcome", "mobile-contract-and-real-session",
].map(id => ({ id, status: "NOT_RUN", evidence: null }));
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(new URL("original.txt", output), original),
  writeFile(new URL("modified.txt", output), modified),
  writeFile(new URL("ncalayer-request.json", output), JSON.stringify(captured, null, 2) + "\n"),
  writeFile(new URL("manifest.json", output), JSON.stringify({
    version: 1, status: "UNSIGNED_PREPARATION_ONLY", realSignatureCreated: false,
    original: { file: "original.txt", byteLength: original.length, sha256: sha256(original) },
    modified: { file: "modified.txt", byteLength: modified.length, sha256: sha256(modified) },
    sdkVersion: null, ncalayerVersion: null, verifierVersion: null, scenarios,
    requiredInputs: ["Official SDK and its verifier examples", "Test certificates with isolated trust anchors", "Test revocation/TSP endpoints and rules", "Confirmed mobile service access"],
  }, null, 2) + "\n"),
]);
console.log("Unsigned NCA prototype packet prepared in .tmp/nca-prototype/packet; all real-signature scenarios NOT_RUN.");
