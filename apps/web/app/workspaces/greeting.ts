export function workspaceGreeting(hour: number, displayName?: string | null) {
  const greeting = hour >= 5 && hour < 12 ? "Доброе утро"
    : hour >= 12 && hour < 18 ? "Добрый день"
    : hour >= 18 && hour < 23 ? "Добрый вечер" : "Доброй ночи";
  const name = displayName?.trim().split(/\s+/)[0];
  return name ? `${greeting}, ${name}` : greeting;
}
