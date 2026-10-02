import type { NextConfig } from "next";
import { frontendDeploymentEnvironment } from "@marketplace/schemas";
import { IMPORT_UPLOAD_MAX_JSON_BYTES } from "@marketplace/schemas/document-upload-limits";
import path from "node:path";

const upstream = new URL(process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4012/api");
if (!["http:", "https:"].includes(upstream.protocol) || upstream.username || upstream.password || upstream.search || upstream.hash || upstream.pathname.replace(/\/$/, "") !== "/api") throw new Error("INTERNAL_API_URL must be a fixed HTTP(S) API origin with /api path");
const config: NextConfig = {
  env: {
    ...frontendDeploymentEnvironment(process.env),
    NEXT_PUBLIC_UNIFIED_APP: "true", NEXT_PUBLIC_API_URL: "/api",
    NEXT_PUBLIC_BUYER_APP_URL: "/", NEXT_PUBLIC_SUPPLIER_APP_URL: "/supplier",
    NEXT_PUBLIC_LANDING_APP_URL: "", NEXT_PUBLIC_LOGIN_URL: "/login",
  },
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@marketplace/ui", "@marketplace/api-client"],
  reactStrictMode: true,
  // Keep bounded headroom for a streaming chunk beyond the API limit: Next drops
  // the entire chunk crossing its clone cap, so one extra byte is insufficient.
  experimental: { proxyClientMaxBodySize: IMPORT_UPLOAD_MAX_JSON_BYTES + 1_048_576 },
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async rewrites() { return [{ source: "/api/:path*", destination: `${upstream.href.replace(/\/$/, "")}/:path*` }]; },
  async headers() { return [{ source: "/(.*)", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ] }]; },
};
export default config;
