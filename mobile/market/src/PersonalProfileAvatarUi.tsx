import { useSyncExternalStore } from "react";
import { Image, StyleSheet } from "react-native";
import type { PersonalProfileAvatar } from "./personal-profile-avatar";
import type { Locale } from "./format-wire";
import { Button, Loading, Notice, Stack, Text } from "./ui/controls";
export const personalAvatarCopy = {
  ru: { open: "Посмотреть фото профиля", retry: "Повторно получить фото профиля", hide: "Скрыть фото профиля", loading: "Получаем фото профиля", missing: "Фото не указано в прочитанных данных профиля", image: "Фото учётной записи", body: "Фото получено отдельным чтением для вашей учётной записи.", issues: { authentication: "Для фото профиля нужно войти снова", denied: "Нет доступа к фото профиля", missing: "Фото профиля сейчас недоступно", throttled: "Слишком много запросов фото. Повторите позже", network: "Не удалось получить фото профиля", contract: "Ответ фото профиля не удалось проверить", size: "Размер фото превышает допустимый для профиля", decode: "Не удалось показать полученное фото профиля" } },
  kk: { open: "Профиль фотосын көру", retry: "Профиль фотосын қайта алу", hide: "Профиль фотосын жасыру", loading: "Профиль фотосын алып жатырмыз", missing: "Профильдің оқылған деректерінде фото көрсетілмеген", image: "Тіркелгі фотосы", body: "Фото тіркелгіңіз үшін бөлек оқу арқылы алынды.", issues: { authentication: "Профиль фотосы үшін қайта кіру қажет", denied: "Профиль фотосына қолжетімділік жоқ", missing: "Профиль фотосы қазір қолжетімсіз", throttled: "Фото сұраулары тым көп. Кейінірек қайталаңыз", network: "Профиль фотосын алу мүмкін болмады", contract: "Профиль фотосының жауабын тексеру мүмкін болмады", size: "Фото өлшемі профиль үшін рұқсат етілген шектен асады", decode: "Алынған профиль фотосын көрсету мүмкін болмады" } },
} as const;
export function PersonalProfileAvatarUi({ model, locale }: { model: PersonalProfileAvatar; locale: Locale }) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot), t = personalAvatarCopy[locale], profile = model.frame();
  if (!profile || !model.supported()) return null;
  if (profile.avatarAssetId === null) return <Text secondary>{t.missing}</Text>;
  if (!model.canLoad()) return null;
  const current = state.profile === profile ? state : { phase: "idle" as const };
  return <Stack>{current.phase === "loading" ? <Loading label={t.loading} /> : current.phase !== "ready" && <Button label={current.phase === "error" ? t.retry : t.open} onPress={() => { void model.load(); }} />}
    {"issue" in current && current.issue && <Notice kind="error" title={t.issues[current.issue]} />}
    {current.phase === "ready" && current.uri && <Stack><Image source={{ uri: current.uri }} resizeMode="contain" style={styles.image} accessible accessibilityRole="image" accessibilityLabel={t.image} onError={() => model.renderFailed(state)} /><Text secondary>{t.body}</Text></Stack>}
    {current.phase !== "idle" && <Button label={t.hide} onPress={model.hide} />}
  </Stack>;
}
const styles = StyleSheet.create({ image: { width: "100%", height: 220 } });
