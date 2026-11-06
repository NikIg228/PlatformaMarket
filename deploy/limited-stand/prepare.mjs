import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, chmodSync, chownSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(process.argv[2] ?? "");
if (!process.argv[2] || root === "/" || existsSync(join(root, "market.env"))) throw new Error("Provide a new dedicated Market shared directory; existing credentials are never overwritten");
const origin = new URL(process.env.STAND_ORIGIN ?? "");
if (origin.protocol !== "https:" || origin.origin !== origin.href.slice(0, -1)) throw new Error("HTTPS origin required");
const secret = () => randomBytes(32).toString("hex");
const write = (name, contents, mode = 0o600, uid) => {
  const file = join(root, name);
  writeFileSync(file, contents, { mode, flag: "wx" });
  chmodSync(file, mode);
  if (uid !== undefined && process.platform !== "win32") chownSync(file, uid, uid);
};
for (const [directory, uid] of [["", 0], ["tls", 0], ["tls/postgres", 70], ["tls/redis", 999], ["postgres", 70], ["redis", 999], ["files", 1000], ["gate", 1000], ["backups", 0]]) {
  const path = join(root, directory);
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, directory.startsWith("tls") ? 0o755 : 0o700);
  if (process.platform !== "win32") chownSync(path, uid, uid);
}
const openssl = (...args) => execFileSync(process.env.OPENSSL_BIN ?? "openssl", args, { stdio: "pipe" });
openssl("req", "-x509", "-newkey", "rsa:3072", "-nodes", "-keyout", join(root, "tls/ca.key"), "-out", join(root, "tls/ca.crt"), "-days", "365", "-subj", "/CN=PlatformaMarket isolated test CA");
chmodSync(join(root, "tls/ca.key"), 0o600);
chmodSync(join(root, "tls/ca.crt"), 0o644);
for (const [name, uid] of [["postgres", 70], ["redis", 999]]) {
  const prefix = join(root, `tls/${name}/server`);
  openssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", `${prefix}.key`, "-out", `${prefix}.csr`, "-subj", `/CN=${name}`);
  write(`tls/${name}/extensions.cnf`, `subjectAltName=DNS:${name},DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n`, 0o644);
  openssl("x509", "-req", "-in", `${prefix}.csr`, "-CA", join(root, "tls/ca.crt"), "-CAkey", join(root, "tls/ca.key"), "-CAcreateserial", "-out", `${prefix}.crt`, "-days", "365", "-extfile", join(root, `tls/${name}/extensions.cnf`));
  chmodSync(`${prefix}.key`, 0o600);
  chmodSync(`${prefix}.crt`, 0o644);
  if (process.platform !== "win32") chownSync(`${prefix}.key`, uid, uid);
}
const databasePassword = secret();
const redisPassword = secret();
write("pg-admin-password", secret(), 0o600, 70);
write("init-db.sql", `CREATE ROLE market_app LOGIN PASSWORD '${databasePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE;\nALTER DATABASE market_stand OWNER TO market_app;\nALTER SCHEMA public OWNER TO market_app;\nGRANT ALL ON SCHEMA public TO market_app;\n`, 0o600, 70);
write("redis.conf", `bind 0.0.0.0\nport 0\ntls-port 6379\ntls-cert-file /run/tls/server.crt\ntls-key-file /run/tls/server.key\ntls-auth-clients no\nrequirepass ${redisPassword}\nappendonly yes\ndir /data\nmaxmemory 64mb\nmaxmemory-policy noeviction\n`, 0o600, 999);
const env = {
  NODE_ENV: "production", DEPLOYMENT_PROFILE: "go_live", LIMITED_TEST_STAND: "true",
  DATABASE_URL: `postgresql://market_app:${databasePassword}@postgres:5432/market_stand?schema=public&sslmode=verify-full&sslrootcert=/run/tls/ca.crt`,
  REDIS_URL: `rediss://default:${redisPassword}@redis:6379`,
  API_HOST: "0.0.0.0", API_PORT: "4000", AUTH_MODE: "jwt", ACCESS_CONTROL_MODE: "ROLE_BASED",
  JWT_SECRET: secret(), JWT_ISSUER: origin.origin, JWT_AUDIENCE: "platformamarket-test-stand", JWT_REQUIRE_MFA: "true",
  SOCIAL_AUTH_ENABLED: "false", AUTH_LOCAL_MAIL_ENABLED: "false", LOCAL_OPERATOR_PASSWORD_LOGIN_ENABLED: "false",
  CORS_ORIGINS: origin.origin, AUTH_EMAIL_BASE_URL: origin.origin, TRUST_PROXY: "true",
  APP_SECURITY_ENCRYPTION_KEY: randomBytes(32).toString("base64"), INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  MEDIA_SIGNING_SECRET: secret(), METRICS_BEARER_TOKEN: secret(),
  OBJECT_STORAGE_DRIVER: "local", LOCAL_STORAGE_PATH: "/data/files", AV_SCAN_MODE: "required", CLAMAV_HOST: "clamav", CLAMAV_PORT: "3310",
  PAYMENT_PROVIDER_MODE: "disabled", BACKGROUND_QUEUE_ENABLED: "true", BACKGROUND_QUEUE_CONCURRENCY: "1",
  NODE_OPTIONS: "--max-old-space-size=448", LOG_LEVEL: "info",
};
write("market.env", Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n") + "\n");
const password = randomBytes(24).toString("base64url");
const salt = randomBytes(16).toString("hex");
write("stand-password.txt", password + "\n");
write("stand.env", `STAND_PASSWORD_HASH=${salt}:${scryptSync(password, salt, 32).toString("hex")}\nSTAND_SIGNING_KEY=${secret()}\n`);
console.log("Prepared separate Market secrets, internal TLS and private data directories; no secrets printed");
