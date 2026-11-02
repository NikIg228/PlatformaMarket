import { useSyncExternalStore } from "react";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { BuyerReviewCreateCommands } from "./buyer-review-create";
import type { BuyerReviewUpdates } from "./buyer-review-update";
import { buyerReviewCopy, buyerReviewTargetsCopy } from "./buyer-review-copy";
import type { Locale } from "./format-wire";
import { Button, Stack, Surface, Text } from "./ui/controls";
export function BuyerReviewTargetsUi({ model, updates, workflow, locale }: { model: BuyerReviewCreateCommands; updates: BuyerReviewUpdates; workflow: OrderWorkflowResponse; locale: Locale }) {
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot); useSyncExternalStore(updates.subscribe, updates.getSnapshot, updates.getSnapshot);
  const rows = model.knownReceipts(workflow), t = buyerReviewTargetsCopy[locale], common = buyerReviewCopy[locale];
  if (!rows.length) return null;
  return <Stack><Text strong>{t.title}</Text><Text secondary>{t.body}</Text>{rows.map(row => { const state = updates.viewForReceipt(workflow, row), known = state.receipt ?? state.base ?? row, name = row.productVariantId === null ? common.supplier : `${common.product}: ${common.line} ${workflow.order.items.findIndex(item => item.productVariantId === row.productVariantId) + 1}`; return <Surface key={row.id}><Text strong>{name}</Text><Text>{t.version}: {known.version}</Text><Text>{common.status[known.status]}</Text><Button label={t.open} accessibilityLabel={`${t.open}: ${name}`} disabled={!model.canSelectKnown(workflow, row)} onPress={() => model.selectKnown(workflow, row)} /></Surface>; })}<Button label={t.another} disabled={!model.canStartAnother(workflow)} onPress={() => model.startAnother(workflow)} /></Stack>;
}
