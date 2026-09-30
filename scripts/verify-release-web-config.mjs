import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export function verifyReleaseWebConfig(env) {
  assert(["pilot", "go_live"].includes(env.DEPLOYMENT_PROFILE), "DEPLOYMENT_PROFILE must be pilot or go_live");
  const web = new URL(env.PUBLIC_WEB_URL);
  assert(web.protocol === "https:" && !web.username && !web.password && !web.search && !web.hash && web.pathname === "/", "PUBLIC_WEB_URL must be an HTTPS origin");
  assert(!["localhost", "127.0.0.1", "[::1]"].includes(web.hostname) && !web.hostname.endsWith(".localhost"), "Release origin cannot be loopback");
  const apple = new URL(env.APPLE_REDIRECT_URI);
  assert(apple.origin === web.origin && !apple.username && !apple.password && !apple.hash, "Apple redirect must stay on the canonical HTTPS origin");
  assert(env.GOOGLE_CLIENT_ID?.trim() && env.APPLE_CLIENT_ID?.trim(), "Release social client IDs are required");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyReleaseWebConfig(process.env);
  console.log("Canonical release origin/profile contract passed");
}
