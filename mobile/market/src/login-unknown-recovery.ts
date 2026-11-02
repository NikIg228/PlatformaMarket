import { emailLoginSchema } from "../../../packages/schemas/src/commercial";
import { currentSessionSchema } from "../../../packages/schemas/src/workspace-session";
export function loginEmailMatches(actual: string, expected: string): boolean { const checked=emailLoginSchema.shape.email.safeParse(actual); return checked.success&&checked.data===expected; }
/** This read identifies an existing source session, never attests the password attempt. */
export function loginCurrent(raw: unknown, canonicalEmail: string) {
  if(raw&&typeof raw==="object"&&"refreshToken" in raw)return undefined;
  const parsed=currentSessionSchema.safeParse(raw);if(!parsed.success)return undefined;const value=parsed.data;
  return loginEmailMatches(value.user.email,canonicalEmail)&&value.organizationIds.includes(value.activeOrganizationId)&&value.workspaces.some(row=>row.organizationId===value.activeOrganizationId)?value:undefined;
}
export const unknownLoginCopy={
  ru:{unknown:"Результат входа неизвестен",body:"Сессия могла создаться. Проверка текущего входа не повторяет пароль. Найденная сессия могла существовать раньше и не подтверждает пароль этой попытки.",check:"Проверить текущий вход",again:"Ввести пароль заново",history:"Результат прежней попытки входа остался неизвестным. Следующий ответ не подтверждает пароль или создание сессии той попытки."},
  kk:{unknown:"Кіру нәтижесі белгісіз",body:"Сеанс құрылған болуы мүмкін. Ағымдағы кіруді тексеру құпиясөзді қайталамайды. Табылған сеанс бұрыннан болуы мүмкін және осы әрекеттегі құпиясөзді растамайды.",check:"Ағымдағы кіруді тексеру",again:"Құпиясөзді қайта енгізу",history:"Алдыңғы кіру әрекетінің нәтижесі белгісіз болып қалды. Кейінгі жауап сол әрекеттің құпиясөзін немесе сеанс құрылғанын растамайды."},
} as const;
