import { readFileSync } from "node:fs";

/** Keep pg's URI parser from replacing the verified TLS configuration. */
export function verifiedPostgresOptions(connectionString, env = process.env) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("PostgreSQL URL required");
  const mode = url.searchParams.get("sslmode");
  if (mode && mode !== "verify-full") throw new Error("Database maintenance requires sslmode=verify-full");
  if (url.searchParams.has("ssl") || url.searchParams.has("uselibpqcompat")) throw new Error("TLS verification cannot be overridden by the database URL");
  const caPath = url.searchParams.get("sslrootcert") ?? env.PGSSLROOTCERT;
  const certPath = url.searchParams.get("sslcert") ?? env.PGSSLCERT;
  const keyPath = url.searchParams.get("sslkey") ?? env.PGSSLKEY;
  for (const name of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) url.searchParams.delete(name);
  return { connectionString: url.href, ssl: { rejectUnauthorized: true,
    ...(caPath ? { ca: readFileSync(caPath, "utf8") } : {}),
    ...(certPath ? { cert: readFileSync(certPath, "utf8") } : {}),
    ...(keyPath ? { key: readFileSync(keyPath, "utf8") } : {}),
  } };
}
