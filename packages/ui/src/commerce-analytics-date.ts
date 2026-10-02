/** Calendar dates become explicit half-open UTC instants for the API. */
export function analyticsDateRange(from: string, through: string, timezone: "Asia/Qyzylorda" | "UTC") {
  const offset = timezone === "UTC" ? "Z" : "+05:00";
  const start = new Date(`${from}T00:00:00${offset}`), end = new Date(`${through}T00:00:00${offset}`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  end.setTime(end.getTime() + 86400000);
  return { from: start.toISOString(), to: end.toISOString() };
}
