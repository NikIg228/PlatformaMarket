import { localDatabaseProfile } from "./local-database-profile.mjs";

export function testDatabaseUrl(env = process.env) {
  if (env.NODE_ENV === "production") throw new Error("Test database commands cannot run in production.");
  if (env.TEST_DATABASE_URL !== undefined && env.POSTGRES_TEST_DATABASE_URL !== undefined && env.TEST_DATABASE_URL !== env.POSTGRES_TEST_DATABASE_URL) {
    throw new Error("Conflicting TEST_DATABASE_URL and POSTGRES_TEST_DATABASE_URL.");
  }
  const explicit = env.TEST_DATABASE_URL ?? env.POSTGRES_TEST_DATABASE_URL;
  if (env.GITHUB_ACTIONS !== "true") {
    return localDatabaseProfile({ ...env, TEST_DATABASE_URL: explicit }).testDatabaseUrl;
  }

  // Only the disposable service of the hosted CI jobs may share DATABASE_URL.
  // Local commands retain the separate dev/test database requirement.
  if (env.RUNNER_ENVIRONMENT !== "github-hosted" || !explicit) {
    throw new Error("CI tests require a GitHub-hosted runner and an explicit test database URL.");
  }
  let target;
  try { target = new URL(explicit); } catch { throw new Error("Invalid CI test database configuration."); }
  if (target.protocol !== "postgresql:" || target.hostname !== "localhost" || target.port !== "5432" || target.pathname !== "/marketplace" || target.username !== "marketplace" || target.search !== "?schema=public" || target.hash) {
    throw new Error("CI tests require the approved disposable PostgreSQL service: marketplace/public.");
  }
  if (env.DATABASE_URL !== undefined && env.DATABASE_URL !== explicit) {
    throw new Error("CI DATABASE_URL must match the explicit test database URL.");
  }
  return explicit;
}
