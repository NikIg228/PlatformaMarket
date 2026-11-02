import { BuyerReviewTargetsUi } from "./BuyerReviewTargetsUi";
import { BuyerReviewDiscoveryUi } from "./BuyerReviewDiscoveryUi";
import { Rating, Summary } from "./BuyerReviewFields";
import { BuyerReviewUpdateUi } from "./BuyerReviewUpdateUi";
import type { BuyerReviewUpdates } from "./buyer-review-update";
import { useSyncExternalStore } from "react";
import { ScrollView, StyleSheet } from "react-native";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { reviewDimensions, type BuyerReviewCreateCommands } from "./buyer-review-create";
import { buyerReviewCopy, buyerReviewTargetsCopy } from "./buyer-review-copy";
import type { Locale } from "./format-wire";
import { Button, FormInput, Loading, Notice, Stack, Surface, Text } from "./ui/controls";
import { theme } from "./ui/theme";

export function BuyerReviewLauncher({ model, updates, workflow, locale }: { model: BuyerReviewCreateCommands; updates?: BuyerReviewUpdates; workflow: OrderWorkflowResponse; locale: Locale }) {
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const supported = model.supports(workflow);
  const t = buyerReviewCopy[locale], state = model.stateFor(workflow.orderId), canOpen = model.canOpen(workflow);
  return <Stack>{supported && <><Button label={state.phase === "idle" && !model.knownReceipts(workflow).length ? t.start : t.resume} disabled={!canOpen} onPress={() => model.open(workflow)} />{!canOpen && <Text secondary>{t.unavailable}</Text>}</>}{updates && <BuyerReviewDiscoveryUi model={updates} create={model} workflow={workflow} locale={locale} />}</Stack>;
}
export function BuyerReviewCreateUi({ model, updates, workflow, locale }: { model: BuyerReviewCreateCommands; updates: BuyerReviewUpdates; workflow: OrderWorkflowResponse; locale: Locale }) {
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useSyncExternalStore(updates.subscribe, updates.getSnapshot, updates.getSnapshot);
  const t = buyerReviewCopy[locale], id = workflow.orderId, state = model.stateFor(id);
  const updatePending = ["pending", "checking"].includes(updates.stateFor(id).phase);
  const variants = workflow.order.items.map((item, index) => ({ item, line: index + 1 })).filter((row, index, rows) => rows.findIndex(other => other.item.productVariantId === row.item.productVariantId) === index);
  const targetId = ["result", "existing"].includes(state.phase) && state.receipt ? state.receipt.productVariantId : state.draft.productVariantId;
  const selected = variants.find(row => row.item.productVariantId === targetId);
  const label = targetId === null ? t.supplier : selected ? `${t.product}: ${t.line} ${selected.line}` : t.unavailableVariant;
  return <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text kind="subtitle">{t.title}</Text><Text>{workflow.order.orderNumber}</Text><BuyerReviewTargetsUi model={model} updates={updates} workflow={workflow} locale={locale} />
    {state.issue && <Notice kind="error" title={t.issue[state.phase === "unknown" && state.issue === "input" ? "contract" : state.issue]} />}
    {state.phase === "editing" ? <>
      <Text strong>{t.target}</Text><Stack row><Button label={t.supplier} tone="tab" role="radio" selected={state.draft.productVariantId === null} disabled={!model.targetAvailable(workflow, null)} onPress={() => model.setTarget(workflow, null)} />{variants.map(({ item, line }) => <Button key={item.productVariantId} label={`${item.offer?.productVariant.product.canonicalName ?? t.product}: ${line}`} accessibilityLabel={`${t.line}: ${line}`} tone="tab" role="radio" selected={state.draft.productVariantId === item.productVariantId} disabled={!model.targetAvailable(workflow, item.productVariantId)} onPress={() => model.setTarget(workflow, item.productVariantId)} />)}</Stack>
      <Rating label={t.overall} value={state.draft.overallRating} onSelect={value => model.setRating(id, "overallRating", value)} />
      {reviewDimensions.map(key => <Rating key={key} label={t.dimensions[key]} value={state.draft.dimensions[key]} onSelect={value => model.setRating(id, key, value)} />)}
      <FormInput accessibilityLabel={t.comment} value={state.draft.comment} onChangeText={value => model.setComment(id, value)} multiline maxLength={4_000} />
      <Button label={t.review} onPress={() => model.prepare(workflow)} /><Button label={t.cancel} onPress={() => model.cancel(id)} />
    </> : <>
      <Text>{t.target}: {label}</Text>{state.input && !["result", "existing"].includes(state.phase) && <Summary input={state.input} locale={locale} />}
      {state.phase === "prepared" && <><Text strong>{t.preview}</Text><Button label={t.confirm} tone="primary" disabled={!model.canConfirm(workflow)} onPress={() => { void model.confirm(workflow); }} /><Button label={t.edit} onPress={() => model.edit(id)} /><Button label={t.cancel} onPress={() => model.cancel(id)} /></>}
      {state.phase === "pending" && <Loading label={t.sending} />}
      {state.phase === "unknown" && <><Notice title={t.unknown} body={t.unknownBody} /><Button label={t.retry} disabled={!model.canRetry(workflow)} onPress={() => { void model.retry(workflow); }} /></>}
      {state.phase === "existing" && state.receipt && <BuyerReviewUpdateUi model={updates} receipt={state.receipt} workflow={workflow} locale={locale} />}
      {state.phase === "result" && state.receipt && <><Notice title={t.saved} /><BuyerReviewUpdateUi model={updates} receipt={state.receipt} workflow={workflow} locale={locale} /></>}
      {state.phase === "rejected" && state.issue === "input" && <Button label={t.edit} onPress={() => model.edit(id)} />}
      {state.phase === "rejected" && ["input", "conflict", "throttled"].includes(state.issue ?? "") && <Button label={buyerReviewTargetsCopy[locale].cancelRejected} onPress={() => model.cancelRejected(id)} />}
      {state.phase !== "pending" && state.phase !== "prepared" && <Button label={t.back} disabled={updatePending} onPress={() => model.hide(id)} />}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({ form: { gap: theme.space.medium, paddingBottom: theme.space.section } });
