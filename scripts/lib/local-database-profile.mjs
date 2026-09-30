const base = "postgresql://marketplace:marketplace@127.0.0.1:5432/";

function identity(value) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Local database profiles require PostgreSQL on loopback.");
  }
  if (["/postgres", "/template0", "/template1", "/", ""].includes(url.pathname)) throw new Error("Use an application database, not a PostgreSQL system database.");
  return `${url.port || "5432"}${decodeURIComponent(url.pathname)}`;
}

export function localDatabaseProfile(env = process.env) {
  if (env.NODE_ENV === "production") throw new Error("Local database preparation cannot run in production.");
  const databaseUrl = env.DATABASE_URL ?? `${base}marketplace?schema=public`;
  const testDatabaseUrl = env.TEST_DATABASE_URL ?? `${base}dentmarket_audit_20260914?schema=public`;
  if (identity(databaseUrl) === identity(testDatabaseUrl)) throw new Error("Dev and test must use different databases. Unset DATABASE_URL to use marketplace for dev.");
  return { databaseUrl, testDatabaseUrl };
}

export function databaseLabel(databaseUrl) {
  const url = new URL(databaseUrl);
  return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
}
