import { useRef, useState, type ComponentRef } from "react";
import { Switch } from "react-native";
import type { MarketSessionController, SessionSnapshot } from "./market-session";
import { parsePasswordResetToken } from "./password-reset";
import { emailResetPasswordSchema } from "../../../packages/schemas/src/commercial";
import type { Locale } from "./format-wire";
import { Button, FormInput, Loading, Notice, Stack, Text, type FormInputHandle } from "./ui/controls";
export const passwordResetCopy = {
  ru: { open: "У меня есть ссылка восстановления", title: "Установить новый пароль", token: "Ссылка или код восстановления из письма", tokenBody: "Вставьте ссылку восстановления из письма или только код из неё. Запрос будет отправлен выбранному серверу приложения.", password: "Новый пароль", repeat: "Повторите новый пароль", review: "Проверить смену пароля", reviewTitle: "Подтвердите смену пароля", consequence: "Пароль учётной записи из ссылки изменится. Все её активные сеансы завершатся. Затем потребуется войти снова.", consent: "Подтверждаю смену пароля и завершение активных сеансов", confirm: "Изменить пароль", edit: "Вернуться к данным восстановления", back: "Вернуться ко входу", forgot: "Запросить новую инструкцию", pending: "Ожидаем ответ о смене пароля", completed: "Сервер подтвердил смену пароля", completedBody: "Активные сеансы учётной записи завершены. Войдите с новым паролем.", unknown: "Результат смены пароля неизвестен", unknownBody: "Повторная отправка не выполняется. Попробуйте войти с новым паролем. Если это не удаётся, запросите новую инструкцию восстановления.", history: "Результат предыдущей попытки смены пароля остался неподтверждённым.", invalidToken: "Проверьте ссылку или код восстановления", invalidPassword: "Пароль должен содержать от 12 до 128 знаков", mismatch: "Пароли должны совпадать", issue: { input: "Проверьте данные восстановления", expired: "Ссылка недействительна, уже использована или истекла. Запросите новую инструкцию.", throttled: "Слишком много попыток. Попробуйте позже", network: "Подтверждённый ответ не получен", contract: "Ответ сервера не удалось проверить" } },
  kk: { open: "Менде қалпына келтіру сілтемесі бар", title: "Жаңа құпиясөз орнату", token: "Хаттағы қалпына келтіру сілтемесі немесе коды", tokenBody: "Хаттағы қалпына келтіру сілтемесін немесе оның кодын қойыңыз. Сұрау қолданбада таңдалған серверге жіберіледі.", password: "Жаңа құпиясөз", repeat: "Жаңа құпиясөзді қайталаңыз", review: "Құпиясөзді ауыстыруды тексеру", reviewTitle: "Құпиясөзді ауыстыруды растаңыз", consequence: "Сілтемедегі тіркелгінің құпиясөзі өзгереді. Оның барлық белсенді сеанстары аяқталады. Содан кейін қайта кіру керек.", consent: "Құпиясөзді ауыстыруды және белсенді сеанстарды аяқтауды растаймын", confirm: "Құпиясөзді ауыстыру", edit: "Қалпына келтіру деректеріне оралу", back: "Кіруге оралу", forgot: "Жаңа нұсқаулық сұрау", pending: "Құпиясөзді ауыстыру жауабын күтеміз", completed: "Сервер құпиясөздің ауысқанын растады", completedBody: "Тіркелгінің белсенді сеанстары аяқталды. Жаңа құпиясөзбен кіріңіз.", unknown: "Құпиясөзді ауыстыру нәтижесі белгісіз", unknownBody: "Қайта жіберілмейді. Жаңа құпиясөзбен кіріп көріңіз. Кіре алмасаңыз, жаңа қалпына келтіру нұсқаулығын сұраңыз.", history: "Құпиясөзді ауыстырудың алдыңғы әрекетінің нәтижесі расталмаған күйде қалды.", invalidToken: "Қалпына келтіру сілтемесін немесе кодын тексеріңіз", invalidPassword: "Құпиясөз 12–128 таңбадан тұруы керек", mismatch: "Құпиясөздер сәйкес болуы керек", issue: { input: "Қалпына келтіру деректерін тексеріңіз", expired: "Сілтеме жарамсыз, қолданылған немесе мерзімі өткен. Жаңа нұсқаулық сұраңыз.", throttled: "Әрекет тым көп. Кейінірек көріңіз", network: "Расталған жауап алынбады", contract: "Сервер жауабын тексеру мүмкін болмады" } },
} as const;
type Field = "token" | "password" | "repeat";
export function PasswordResetUi({ controller, snapshot, locale, onBack, onForgot }: { controller: MarketSessionController; snapshot: SessionSnapshot; locale: Locale; onBack: () => void; onForgot: () => void }) {
  const [token, setToken] = useState(""), [password, setPassword] = useState(""), [repeat, setRepeat] = useState(""), [review, setReview] = useState(false), [consent, setConsent] = useState(false), [errors, setErrors] = useState<Partial<Record<Field, boolean>>>({});
  const tokenRef = useRef<FormInputHandle>(null), passwordRef = useRef<FormInputHandle>(null), repeatRef = useRef<FormInputHandle>(null), consentRef = useRef<ComponentRef<typeof Switch>>(null), t = passwordResetCopy[locale], pending = snapshot.phase === "working", feedback = snapshot.passwordReset, finished = feedback?.phase === "completed" || feedback?.phase === "unknown";
  const clear = () => { setToken(""); setPassword(""); setRepeat(""); setConsent(false); setReview(false); setErrors({}); };
  const problem = (field: Field) => field === "token" ? t.invalidToken : field === "password" ? t.invalidPassword : t.mismatch;
  const prepare = () => {
    if (pending || finished) return;
    const next: Partial<Record<Field, boolean>> = {};
    try { parsePasswordResetToken(token); } catch { next.token = true; }
    if (!emailResetPasswordSchema.shape.password.safeParse(password).success) next.password = true;
    if (password !== repeat) next.repeat = true;
    setErrors(next);
    if (Object.keys(next).length) { (next.token ? tokenRef : next.password ? passwordRef : repeatRef).current?.focus(); return; }
    setConsent(false); setReview(true);
  };
  const submit = () => {
    if (pending || finished || !review) return;
    if (!consent) { consentRef.current?.focus(); return; }
    const input = { token, password }; clear(); void controller.completePasswordReset(input);
  };
  const edit = (field: Field, value: string) => { setConsent(false); setErrors(previous => { const next = { ...previous }; delete next[field]; return next; }); if (field === "token") setToken(value); else if (field === "password") setPassword(value); else setRepeat(value); };
  return <Stack><Text kind="subtitle">{t.title}</Text>{snapshot.passwordResetUncertain && feedback?.phase !== "unknown" && <Notice title={t.history} />}
    {!pending && !finished && !review && <Stack><Text secondary>{t.tokenBody}</Text><FormInput ref={tokenRef} autoFocus accessibilityLabel={t.token} accessibilityHint={errors.token ? t.invalidToken : undefined} value={token} onChangeText={value => edit("token", value)} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" maxLength={4096} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()} />{errors.token && <Notice kind="error" title={t.invalidToken} />}
      {(["password", "repeat"] as const).map(field => <Stack key={field}><FormInput ref={field === "password" ? passwordRef : repeatRef} accessibilityLabel={field === "password" ? t.password : t.repeat} accessibilityHint={errors[field] ? problem(field) : undefined} secureTextEntry value={field === "password" ? password : repeat} onChangeText={value => edit(field, value)} autoCapitalize="none" autoCorrect={false} maxLength={128} autoComplete="new-password" textContentType="newPassword" returnKeyType={field === "password" ? "next" : "go"} submitBehavior="submit" onSubmitEditing={field === "password" ? () => repeatRef.current?.focus() : prepare} />{errors[field] && <Notice kind="error" title={problem(field)} />}</Stack>)}<Button label={t.review} onPress={prepare} /></Stack>}
    {review && !pending && !finished && <Stack><Text kind="subtitle">{t.reviewTitle}</Text><Text>{t.consequence}</Text><Text>{t.consent}</Text><Switch ref={consentRef} accessibilityLabel={t.consent} value={consent} onValueChange={setConsent} /><Button label={t.confirm} tone="primary" onPress={submit} /><Button label={t.edit} onPress={() => { setConsent(false); setReview(false); }} /></Stack>}
    {pending && <Loading label={t.pending} />}
    {feedback?.phase === "completed" && <Notice title={t.completed} body={t.completedBody} />}
    {feedback?.phase === "unknown" && <Notice title={t.unknown} body={t.unknownBody} />}
    {feedback?.issue && <Notice kind="error" title={t.issue[feedback.issue]} />}
    <Button label={t.back} disabled={pending} onPress={() => { clear(); onBack(); }} /><Button label={t.forgot} disabled={pending} onPress={() => { clear(); onForgot(); }} />
  </Stack>;
}
