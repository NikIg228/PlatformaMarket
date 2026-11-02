import { useSyncExternalStore } from "react";
import { Image, StyleSheet } from "react-native";
import type { CatalogMediaPreview } from "./catalog-media-preview";
import type { CatalogProduct } from "./native-catalog-media";
import type { Locale } from "./format-wire";
import { Button, Loading, Notice, Stack, Text } from "./ui/controls";
export const catalogMediaCopy = {
  ru: { open: "Посмотреть изображения товара", image: "Изображение товара", loading: "Получаем изображение товара", unavailable: "Изображение товара не показано", unavailableBody: "Обновите данные каталога и попробуйте снова. Ссылка на изображение может устареть.", refresh: "Обновить данные каталога для изображений", retry: "Повторить показ изображения", hide: "Скрыть изображения товара", previous: "Предыдущее изображение", next: "Следующее изображение", position: "Доступное изображение", missing: "Нормализованные изображения товара пока недоступны" },
  kk: { open: "Тауар суреттерін көру", image: "Тауар суреті", loading: "Тауар суретін алып жатырмыз", unavailable: "Тауар суреті көрсетілмеді", unavailableBody: "Каталог деректерін жаңартып, қайта көріңіз. Сурет сілтемесі ескіруі мүмкін.", refresh: "Суреттер үшін каталог деректерін жаңарту", retry: "Суретті қайта көрсету", hide: "Тауар суреттерін жасыру", previous: "Алдыңғы сурет", next: "Келесі сурет", position: "Қолжетімді сурет", missing: "Тауардың қалыпқа келтірілген суреттері әзірге қолжетімсіз" },
} as const;
export function CatalogMediaUi({ model, product, locale, onRefresh }: { model: CatalogMediaPreview; product: CatalogProduct; locale: Locale; onRefresh?: () => void }) {
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot); const t = catalogMediaCopy[locale], state = model.viewFor(product);
  if (!model.supported() || !model.owns(product)) return null;
  if (!model.eligible(product).length) return <Text secondary>{t.missing}</Text>;
  if (state.phase === "idle") return <Button label={t.open} accessibilityLabel={`${t.open}: ${product.name}`} onPress={() => model.open(product)} />;
  const { selection } = state;
  return <Stack>{state.phase === "loading" && <Loading label={t.loading} />}
    {state.phase === "error" ? <Stack><Notice kind="error" title={t.unavailable} body={t.unavailableBody} /><Button label={t.retry} onPress={() => model.open(product, selection.media)} />{onRefresh && <Button label={t.refresh} onPress={onRefresh} />}</Stack> : <Image key={selection.renderIdentity} source={selection.source} resizeMode="contain" style={styles.image} accessible accessibilityRole="image" accessibilityLabel={`${t.image}: ${product.name}`} onLoad={() => model.loaded(selection)} onError={() => model.failed(selection)} />}
    {selection.media.altText?.trim() && <Text>{selection.media.altText}</Text>}<Text>{t.position}: {selection.position}/{selection.total}</Text>
    <Stack row><Button label={t.previous} disabled={selection.position <= 1} onPress={() => model.step(-1)} /><Button label={t.next} disabled={selection.position >= selection.total} onPress={() => model.step(1)} /><Button label={t.hide} onPress={model.hide} /></Stack>
  </Stack>;
}
const styles = StyleSheet.create({ image: { width: "100%", height: 180 } });
