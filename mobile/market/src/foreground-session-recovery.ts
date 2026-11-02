import type { CurrentSession } from "../../../packages/schemas/src/workspace-session";
export type KnownWorkspaceOwner = Readonly<{ userId: string; organizationId: string; sessionId: string }>;
export function sameRestoredOwner(value: CurrentSession, owner: KnownWorkspaceOwner): boolean {
  return value.user.id === owner.userId && value.sessionId === owner.sessionId && value.activeOrganizationId === owner.organizationId;
}
export const foregroundSessionCopy = {
  ru: { continue: "Повторить проверку текущего сеанса", blocked: "Текущий сеанс не подтверждён", body: "Кабинет закрыт до новой проверки сервера. Повторная проверка относится к прежним аккаунту, организации и сеансу. Чтобы сменить аккаунт, сначала завершите этот вход. Смена адреса сервера сбрасывает локальное подключение. Серверный сеанс завершается отдельной кнопкой «Выйти».", },
  kk: { continue: "Ағымдағы сеансты қайта тексеру", blocked: "Ағымдағы сеанс расталмады", body: "Сервер қайта тексергенше кабинет жабық. Қайта тексеру алдыңғы аккаунтқа, ұйымға және сеансқа қатысты. Аккаунтты ауыстыру үшін алдымен осы кіруді аяқтаңыз. Сервер мекенжайын өзгерту жергілікті қосылымды өшіреді. Сервердегі сеанс «Шығу» түймесімен бөлек аяқталады.", },
} as const;
