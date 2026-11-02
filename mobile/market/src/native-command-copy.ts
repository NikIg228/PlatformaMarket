/** Adapt static fixture labels only. Request data and user text never pass through this helper. */
export function withoutTestLabel<T extends Readonly<Record<string, unknown>>>(labels: T): Readonly<{ [K in keyof T]: T[K] extends string ? string : T[K] }> {
  return Object.freeze(Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, typeof value === "string" ? value.replaceAll(" (тест)", "") : value]))) as Readonly<{ [K in keyof T]: T[K] extends string ? string : T[K] }>;
}
