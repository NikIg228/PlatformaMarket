export function validAuthMailRelay(config: {
  NODE_ENV?: string; LIMITED_TEST_STAND?: boolean; AUTH_MAIL_RELAY_URL?: string; AUTH_MAIL_RELAY_TOKEN?: string;
}) {
  if (!config.AUTH_MAIL_RELAY_URL || !config.AUTH_MAIL_RELAY_TOKEN || config.AUTH_MAIL_RELAY_TOKEN.length < 32) return false;
  try {
    const url = new URL(config.AUTH_MAIL_RELAY_URL);
    if (url.username || url.password || url.hash || url.search || url.pathname !== "/send") return false;
    if (config.LIMITED_TEST_STAND) return url.href === "http://auth-mail-relay:8091/send";
    return url.protocol === "https:" || (config.NODE_ENV !== "production" && url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
  } catch { return false; }
}

export function authMailTimeout(config: Parameters<typeof validAuthMailRelay>[0]) {
  return validAuthMailRelay(config) ? 10_000 : 2_000;
}
