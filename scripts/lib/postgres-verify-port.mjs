export function postgresVerifyPort(override, pid = process.pid) {
  // The former 4400..5399 range includes 5060/5061, rejected by Node fetch.
  const port = override === undefined ? 49152 + (pid % 10000) : Number(override);
  const blocked = [1719, 1720, 1723, 2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080];
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || blocked.includes(port)) {
    throw new Error("POSTGRES_VERIFY_API_PORT must be an unprivileged HTTP-safe port");
  }
  return port;
}
