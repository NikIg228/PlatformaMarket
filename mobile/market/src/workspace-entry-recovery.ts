import { currentSessionSchema, workspaceHandoffResponseSchema, workspaceExchangeRequestSchema } from "../../../packages/schemas/src/workspace-session";
const hasRefreshSecret = (raw: unknown) => !!raw && typeof raw === "object" && "refreshToken" in raw;
/** Source handoff is short-lived and one-use; validate before exchanging, never persist the code. */
export function workspaceEntryCode(raw: unknown, organizationId: string, now: number) {
  if (hasRefreshSecret(raw)) return undefined;
  const parsed = workspaceHandoffResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.organizationId !== organizationId || parsed.data.capability !== "BUYER" || Date.parse(parsed.data.expiresAt) <= now) return undefined;
  const body = workspaceExchangeRequestSchema.safeParse({ handoffCode: parsed.data.handoffCode });
  return body.success ? Object.freeze(body.data) : undefined;
}
/** Independent current-cookie read: matching this target does not attest the earlier exchange attempt. */
export function workspaceEntryCurrent(raw: unknown, userId: string, organizationId: string) {
  if (hasRefreshSecret(raw)) return undefined;
  const parsed = currentSessionSchema.safeParse(raw);
  if (!parsed.success || parsed.data.user.id !== userId || parsed.data.activeOrganizationId !== organizationId || !parsed.data.organizationIds.includes(organizationId) || !parsed.data.workspaces.some(row => row.organizationId === organizationId && row.capabilities.includes("BUYER"))) return undefined;
  return parsed.data;
}
export const workspaceEntryCopy = {
  ru: { continue: "Продолжить вход в организацию", check: "Проверить текущий кабинет", known: "Сервер подтвердил сессию выбранной организации. Продолжите проверку доступа без повторного обмена.", unknown: "Результат перехода неизвестен. Повторный обмен не выполняется. Можно отдельно проверить текущий кабинет в этом приложении.", independent: "Проверка текущего кабинета не подтверждает результат прежнего перехода: сессия могла существовать раньше.", history: "Результат прежнего перехода остался неизвестным. Отдельное чтение текущей сессии не подтверждает результат той попытки.", target: "Выбранная организация" },
  kk: { continue: "Ұйымға кіруді жалғастыру", check: "Ағымдағы кабинетті тексеру", known: "Сервер таңдалған ұйымның сеансын растады. Алмасуды қайталамай, қолжетімділікті тексеруді жалғастырыңыз.", unknown: "Өту нәтижесі белгісіз. Алмасу қайталанбайды. Осы қолданбадағы ағымдағы кабинетті бөлек тексеруге болады.", independent: "Ағымдағы кабинетті тексеру алдыңғы өту нәтижесін растамайды: сеанс бұрыннан болуы мүмкін.", history: "Алдыңғы өту нәтижесі белгісіз болып қалды. Ағымдағы сеансты бөлек оқу сол әрекеттің нәтижесін растамайды.", target: "Таңдалған ұйым" },
} as const;
