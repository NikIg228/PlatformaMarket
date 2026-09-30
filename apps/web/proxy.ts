import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const dev = process.env.NODE_ENV !== "production";
  const auth = /^\/(?:login|register|verify-email|reset-password|admin\/login)(?:\/|$)/.test(request.nextUrl.pathname);
  const csp = `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:${auth ? " https://*.googleusercontent.com" : ""}; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""}${auth ? " https://accounts.google.com https://appleid.cdn-apple.com" : ""}; connect-src 'self'${dev ? " ws: wss:" : ""}${auth ? " https://accounts.google.com https://appleid.apple.com" : ""}; frame-src ${auth ? "https://accounts.google.com https://appleid.apple.com" : "'none'"}; form-action 'self'${auth ? " https://appleid.apple.com" : ""}`;
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce); headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  // Public pages may render session-aware controls. Never share their HTML/RSC.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|catalog/products/|brand/).*)"] };
