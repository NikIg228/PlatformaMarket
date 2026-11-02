import { sessionLogoutRequestSchema } from "../../../packages/schemas/src/session-logout";
import { currentSessionSchema } from "../../../packages/schemas/src/workspace-session";
export type LogoutTarget = Readonly<{ sessionId: string; userId: string; activeOrganizationId: string | null; workspace?: "BUYER" }>;
export function pinLogoutBody(sessionId: string, accessToken: string) {
  const parsed=sessionLogoutRequestSchema.safeParse({sessionId,accessToken}); return parsed.success?Object.freeze(parsed.data):undefined;
}
export function logoutCurrent(raw: unknown, target: LogoutTarget) {
  if (raw&&typeof raw==="object"&&"refreshToken" in raw) return undefined;
  const parsed=currentSessionSchema.safeParse(raw); if(!parsed.success)return undefined;const value=parsed.data;
  if(value.sessionId!==target.sessionId||value.user.id!==target.userId||value.activeOrganizationId!==target.activeOrganizationId||!value.organizationIds.includes(value.activeOrganizationId)||!value.workspaces.some(row=>row.organizationId===value.activeOrganizationId&&(!target.workspace||row.capabilities.includes("BUYER"))))return undefined;
  return value;
}
export const logoutRecoveryCopy={
  ru:{pending:"Выход не подтверждён",body:"Данные кабинета закрыты. Проверка исходного сеанса не отправляет выход повторно.",check:"Проверить исходный сеанс",retry:"Повторить исходный выход",history:"Результат прежней отправки выхода остался неизвестным. Отдельное чтение не подтверждает результат той попытки."},
  kk:{pending:"Шығу расталмады",body:"Кабинет деректері жабық. Бастапқы сеансты тексеру шығу сұрауын қайталамайды.",check:"Бастапқы сеансты тексеру",retry:"Бастапқы шығуды қайталау",history:"Алдыңғы шығу сұрауының нәтижесі белгісіз болып қалды. Бөлек оқу сол әрекеттің нәтижесін растамайды."},
} as const;
