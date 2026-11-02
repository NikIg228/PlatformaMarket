import { mfaChallengeResultSchema } from "../../../packages/schemas/src/auth-api";
import { mfaCodeInputSchema } from "./native-mfa";

/** Pre-workspace entry uses the actual private server session, without inventing a read scope. */
export function authEntryCode(code: string): string | undefined {
  const parsed = mfaCodeInputSchema.safeParse({ code });
  return parsed.success ? parsed.data.code : undefined;
}
export function authEntryElevation(raw: unknown, code: string, organizationId: string, challenges: ReadonlySet<string>) {
  const parsed = mfaChallengeResultSchema.safeParse(raw);
  if (!parsed.success || !("accessToken" in parsed.data)) return undefined;
  const value = parsed.data;
  if (value.activeOrganizationId !== organizationId || !value.authenticationMethods.includes("totp") || value.factor.method !== (/^\d{6}$/.test(code) ? "TOTP" : "RECOVERY_CODE") || challenges.has(value.factor.challengeId)) return undefined;
  return value;
}
export const authEntryCopy = {
  ru: {
    continue: "Продолжить текущий вход", pending: "Сервер подтвердил сессию. Продолжите загрузку организаций без повторной отправки пароля или кода.",
    elevated: "Код подтверждён. Продолжите загрузку организаций без повторной проверки кода.",
    unknown: "Результат проверки кода неизвестен. Резервный код мог быть использован. Приложение не повторяет эту отправку; для новой проверки введите новый код.",
    history: "Ранее результат одной проверки остался неизвестным. Последующий ответ не подтверждает результат той попытки.",
    rejected: "Сервер не принял эту проверку. Повторная отправка автоматически не выполняется.",
  },
  kk: {
    continue: "Ағымдағы кіруді жалғастыру", pending: "Сервер сеансты растады. Құпиясөзді немесе кодты қайта жібермей, ұйымдарды жүктеуді жалғастырыңыз.",
    elevated: "Код расталды. Кодты қайта тексермей, ұйымдарды жүктеуді жалғастырыңыз.",
    unknown: "Кодты тексеру нәтижесі белгісіз. Резервтік код қолданылған болуы мүмкін. Қолданба бұл сұрауды қайталамайды; жаңа тексеру үшін жаңа код енгізіңіз.",
    history: "Алдыңғы тексерудің нәтижесі белгісіз болып қалды. Кейінгі жауап сол әрекеттің нәтижесін растамайды.",
    rejected: "Сервер бұл тексеруді қабылдамады. Автоматты қайта жіберу орындалмайды.",
  },
} as const;
