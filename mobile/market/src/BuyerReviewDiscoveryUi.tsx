import { useSyncExternalStore } from "react";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { BuyerReviewUpdates } from "./buyer-review-update";
import type { BuyerReviewCreateCommands } from "./buyer-review-create";
import { buyerReviewCopy } from "./buyer-review-copy";
import { formatTimestamp, type Locale } from "./format-wire";
import { Button, Loading, Notice, Stack, Surface, Text } from "./ui/controls";
export const buyerReviewDiscoveryCopy = {
  ru: { find: "Найти мои опубликованные отзывы по заказу", loading: "Читаем опубликованные отзывы", body: "Поиск среди последних 200 опубликованных отзывов поставщика. Показаны только ваши отзывы по этому заказу. Ожидающие публикации и скрытые отзывы в этом окне не видны. Отсутствие строки не подтверждает результат прежней отправки.", empty: "В этом окне ваши отзывы по заказу не найдены", title: "Мои опубликованные отзывы по заказу", edit: "Изменить найденный отзыв", unavailable: "Изменение этого отзыва сейчас недоступно", version: "Версия отзыва", deadline: "Изменить до", refresh: "Повторить поиск опубликованных отзывов" },
  kk: { find: "Тапсырыс бойынша жарияланған пікірлерімді табу", loading: "Жарияланған пікірлерді оқып жатырмыз", body: "Жеткізушінің соңғы 200 жарияланған пікірінің ішінен іздеу. Тек осы тапсырыс бойынша сіздің пікірлеріңіз көрсетіледі. Жариялануды күткен және жасырылған пікірлер бұл терезеде көрінбейді. Жолдың болмауы бұрынғы жіберу нәтижесін растамайды.", empty: "Бұл терезеде тапсырыс бойынша пікірлеріңіз табылмады", title: "Тапсырыс бойынша жарияланған пікірлерім", edit: "Табылған пікірді өзгерту", unavailable: "Бұл пікірді қазір өзгерту қолжетімсіз", version: "Пікір нұсқасы", deadline: "Өзгерту мерзімі", refresh: "Жарияланған пікірлерді қайта іздеу" },
} as const;
export function BuyerReviewDiscoveryUi({ model, create, workflow, locale }: { model: BuyerReviewUpdates; create: BuyerReviewCreateCommands; workflow: OrderWorkflowResponse; locale: Locale }) {
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const t = buyerReviewDiscoveryCopy[locale], common = buyerReviewCopy[locale], state = model.stateFor(workflow.orderId), discovery = state.discovery;
  if (!model.supportsDiscovery(workflow)) return null;
  const rows = discovery?.receipts ?? [];
  const target = (variantId: string | null) => variantId === null ? common.supplier : `${common.product}: ${common.line} ${workflow.order.items.findIndex(item => item.productVariantId === variantId) + 1}`;
  return <Stack><Text secondary>{t.body}</Text>
    <Button label={discovery ? t.refresh : t.find} disabled={!model.canDiscover(workflow)} onPress={() => { void model.discover(workflow); }} />
    {discovery?.phase === "loading" && <Loading label={t.loading} />}
    {discovery?.phase === "empty" && <Notice title={t.empty} />}
    {discovery?.issue && <Notice kind="error" title={common.issue[discovery.issue]} />}
    {discovery?.phase === "ready" && <><Text strong>{t.title}</Text>{rows.map(row => { const allowed = model.canSelectDiscovered(workflow, row) && create.canOpenExisting(workflow, row), name = target(row.productVariantId); return <Surface key={row.id}><Text strong>{name}</Text><Text>{common.overall}: {row.overallRating} / 5</Text><Text>{t.version}: {row.version}</Text><Text>{t.deadline}: {formatTimestamp(row.editDeadline, locale) ?? row.editDeadline}</Text>
      <Button label={t.edit} accessibilityLabel={`${t.edit}: ${name}`} disabled={!allowed} onPress={() => { if (create.canOpenExisting(workflow, row) && model.canSelectDiscovered(workflow, row) && create.openExisting(workflow, row)) model.selectDiscovered(workflow, row); }} />{!allowed && <Text secondary>{t.unavailable}</Text>}
    </Surface>; })}</>}
  </Stack>;
}
