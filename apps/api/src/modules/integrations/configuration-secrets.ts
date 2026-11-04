import type { Prisma } from "@prisma/client";

const sensitiveKey = /(^|_|-)(tokens?|secrets?|password|passwd|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|authorization|credentials?)(_|-|$)/i;
const isSensitive = (key: string) => sensitiveKey.test(key.replace(/([a-z0-9])([A-Z])/g, "$1_$2"));

function redact(value: unknown): { publicValue: unknown; sensitiveValue: unknown; hasSecrets: boolean } {
  if (Array.isArray(value)) {
    const items = value.map(redact);
    return { publicValue: items.map(item => item.publicValue), sensitiveValue: items.map(item => item.hasSecrets ? item.sensitiveValue : null), hasSecrets: items.some(item => item.hasSecrets) };
  }
  if (!value || typeof value !== "object") return { publicValue: value, sensitiveValue: null, hasSecrets: false };
  const fields: [string, unknown][] = [], secrets: [string, unknown][] = [];
  let hasSecrets = false;
  for (const [key, item] of Object.entries(value)) {
    if (isSensitive(key)) { hasSecrets = true; secrets.push([key, item]); continue; }
    const nested = redact(item);
    fields.push([key, nested.publicValue]);
    if (nested.hasSecrets) secrets.push([key, nested.sensitiveValue]);
    hasSecrets ||= nested.hasSecrets;
  }
  return { publicValue: Object.fromEntries(fields), sensitiveValue: Object.fromEntries(secrets), hasSecrets };
}

export function protectConfiguration(value: unknown): { publicValue: unknown; sensitiveValue: Record<string, unknown> } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { publicValue: redact(value).publicValue, sensitiveValue: {} };
  const result = redact(value);
  return { publicValue: result.publicValue, sensitiveValue: result.sensitiveValue as Record<string, unknown> };
}

export function restoreConfiguration(publicValue: unknown, sensitiveValue: unknown): unknown {
  if (Array.isArray(sensitiveValue)) {
    const items = Array.isArray(publicValue) ? publicValue : sensitiveValue.map(() => null);
    return items.map((item, index) => sensitiveValue[index] == null ? item : restoreConfiguration(item, sensitiveValue[index]));
  }
  if (!sensitiveValue || typeof sensitiveValue !== "object") return sensitiveValue;
  const fields = new Map(Object.entries(publicValue && typeof publicValue === "object" && !Array.isArray(publicValue) ? publicValue : {}));
  for (const [key, secret] of Object.entries(sensitiveValue)) fields.set(key, restoreConfiguration(fields.get(key), secret));
  return Object.fromEntries(fields);
}

export function publicConfiguration<T extends { configuration: Prisma.JsonValue }>(row: T): T {
  return { ...row, configuration: protectConfiguration(row.configuration).publicValue as Prisma.JsonValue };
}
