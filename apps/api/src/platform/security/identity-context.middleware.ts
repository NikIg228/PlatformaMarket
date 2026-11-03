import { UnauthorizedException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { environment, type MarketplaceEnvironment } from "../config/environment";

type MarketplaceClaims = JwtPayload & { organization_id?: string; organization_ids?: string[]; amr?: string[] | string; personal?: boolean };
type SessionVerifier = { assertActive(sessionId: string, userId: string): Promise<void> };

export function resolveJwtActor(token: string, requestedOrganizationId: string | undefined, config: MarketplaceEnvironment, allowMfaBootstrap = false, personal = false) {
  const key = (config.JWT_PUBLIC_KEY ?? config.JWT_SECRET)?.replaceAll("\\n", "\n");
  if (!key) throw new UnauthorizedException("JWT verification key is not configured");
  let claims: MarketplaceClaims;
  try {
    const verified = jwt.verify(token, key, { issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE, algorithms: config.JWT_PUBLIC_KEY ? ["RS256", "ES256"] : ["HS256"] });
    if (typeof verified === "string") throw new Error("JWT payload is not an object");
    claims = verified as MarketplaceClaims;
  } catch {
    throw new UnauthorizedException("Bearer token is invalid or expired");
  }
  if (!claims.sub) throw new UnauthorizedException("Bearer token has no subject");
  if (personal !== (claims.personal === true)) throw new UnauthorizedException("Bearer token does not match the purchase context");
  const allowedOrganizations = claims.organization_ids ?? (claims.organization_id ? [claims.organization_id] : []);
  const organizationId = requestedOrganizationId ?? claims.organization_id ?? (allowedOrganizations.length === 1 ? allowedOrganizations[0] : undefined);
  if (personal ? Boolean(requestedOrganizationId || claims.organization_id || allowedOrganizations.length) : (!organizationId || !allowedOrganizations.includes(organizationId))) throw new UnauthorizedException("Active organization is not allowed by the bearer token");
  const methods = Array.isArray(claims.amr) ? claims.amr : claims.amr ? [claims.amr] : [];
  // Issued only by the password + active operator membership flow. This session
  // is bound to one organization; ordinary password/social sessions still require MFA.
  const operatorPassword = methods.includes("operator_password") && methods.includes("password") && allowedOrganizations.length === 1 && claims.organization_id === organizationId && typeof claims.jti === "string";
  if (config.JWT_REQUIRE_MFA && !allowMfaBootstrap && !operatorPassword && !methods.some((method) => ["mfa", "otp", "totp"].includes(method.toLowerCase()))) throw new UnauthorizedException("Multi-factor authentication is required");
  return { actorId: claims.sub, organizationId, authenticationMethods: methods, sessionId: typeof claims.jti === "string" ? claims.jti : undefined };
}

export function identityContextMiddleware(sessionVerifier?: SessionVerifier) {
  const config = environment();
  return (request: Request, _response: Response, next: NextFunction) => {
    const authorization = request.header("authorization");
    const connectorRequest = request.method === "POST" && /^\/api\/connector-agents\/[^/]+\/(?:enroll|heartbeat|jobs\/claim|jobs\/[^/]+\/(?:complete|fail))\/?$/.test(request.originalUrl.split("?")[0] ?? "");
    const personal = /^\/api\/personal\/carts(?:\/|$)/.test(request.originalUrl.split("?")[0] ?? "");
    const metricsRequest = ["GET", "HEAD"].includes(request.method) && /^\/api\/metrics\/?(?:\?|$)/.test(request.originalUrl);
    if (config.AUTH_MODE === "development" && !authorization && !metricsRequest && !connectorRequest && !personal) return next();
    const requestedOrganizationId = request.header("x-organization-id");
    delete request.headers["x-user-id"];
    delete request.headers["x-organization-id"];
    delete request.headers["x-session-id"];
    delete request.headers["x-authentication-methods"];
    // Scraper and connector controllers verify their own credentials, not user JWTs.
    if (metricsRequest || connectorRequest) return next();
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return next();
    void (async () => {
      try {
      const allowMfaBootstrap = /^\/api\/identity\/mfa(?:\/|$)/.test(request.originalUrl.split("?")[0] ?? "");
      const actor = resolveJwtActor(token, requestedOrganizationId, config, allowMfaBootstrap, personal);
      if (!sessionVerifier || !actor.sessionId) throw new UnauthorizedException("Bearer token is not bound to an active session");
      await sessionVerifier.assertActive(actor.sessionId, actor.actorId);
      request.headers["x-user-id"] = actor.actorId;
      if (actor.organizationId) request.headers["x-organization-id"] = actor.organizationId;
      request.headers["x-authentication-methods"] = actor.authenticationMethods.join(",");
      if (actor.sessionId) request.headers["x-session-id"] = actor.sessionId;
      next();
      } catch (error) { next(error); }
    })();
  };
}
