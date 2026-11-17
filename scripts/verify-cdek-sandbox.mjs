import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Explicit sandbox-only smoke. No customer data, order creation or live credentials.
if (process.env.NODE_ENV === "production") throw new Error("Sandbox smoke cannot run in production");
const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/verify-cdek-sandbox.mjs <local-credentials.json> [receipt.json]");
const credentials = JSON.parse(await readFile(resolve(file), "utf8"));
const base = "https://api.edu.cdek.ru/v2";
async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`CDEK sandbox HTTP ${response.status}`);
  return response.json();
}
try {
  const auth = await request("/oauth/token", { method: "POST", body: new URLSearchParams({ grant_type: "client_credentials", client_id: credentials.CDEK_SANDBOX_CLIENT_ID, client_secret: credentials.CDEK_SANDBOX_CLIENT_SECRET }) });
  if (!auth.access_token) throw new Error("Sandbox token missing");
  const headers = { Authorization: `Bearer ${auth.access_token}`, "content-type": "application/json" };
  const cities = await Promise.all(["Алматы", "Караганда"].map(city => request(`/location/cities?${new URLSearchParams({ country_codes: "KZ", city, size: "30" })}`, { headers })));
  if (cities.some(rows => !rows.length)) throw new Error("Sandbox route cities unavailable");
  const quote = await request("/calculator/tarifflist", { method: "POST", headers, body: JSON.stringify({ type: 1, currency: 2, lang: "rus", from_location: { code: cities[0][0].code }, to_location: { code: cities[1][0].code }, packages: [{ weight: 1000, length: 20, width: 20, height: 10 }] }) });
  if (!quote.tariff_codes?.length) throw new Error("Sandbox route returned no tariffs");
  const receipt = { checkedAt: new Date().toISOString(), mode: "sandbox", origin: base, auth: "PASS", currency: "KZT", currencyCode: 2, route: cities.map(rows => ({ city: rows[0].city, code: rows[0].code })), tariffCount: quote.tariff_codes.length, orderCreated: false, customerDataSent: false };
  if (process.argv[3]) await writeFile(resolve(process.argv[3]), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt));
} catch (error) {
  console.error(error instanceof Error && /^CDEK sandbox HTTP \d+$/.test(error.message) ? error.message : "CDEK sandbox smoke failed; credentials and upstream body withheld");
  process.exitCode = 1;
}
