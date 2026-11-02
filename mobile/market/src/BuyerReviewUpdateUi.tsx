import { useSyncExternalStore } from "react";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { reviewDimensions, type BuyerReviewReceipt } from "./buyer-review-create";
import type { BuyerReviewUpdates } from "./buyer-review-update";
import { buyerReviewCopy, buyerReviewUpdateCopy } from "./buyer-review-copy";
import { Rating, Summary } from "./BuyerReviewFields";
import { formatTimestamp, type Locale } from "./format-wire";
import { Button, FormInput, Loading, Notice, Stack, Surface, Text } from "./ui/controls";

export function BuyerReviewUpdateUi({ model, receipt, workflow, locale }: { model: BuyerReviewUpdates; receipt: BuyerReviewReceipt; workflow: OrderWorkflowResponse; locale: Locale }) {
  useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const id = workflow.orderId, state = model.viewForReceipt(workflow, receipt), t = buyerReviewUpdateCopy[locale], common = buyerReviewCopy[locale];
  const shown = state.receipt ?? state.base ?? receipt;
  return <Surface><Text kind="subtitle">{t.title}</Text><Text secondary>{t.deadline}: {formatTimestamp((state.receipt ?? state.base ?? receipt).editDeadline, locale) ?? (state.receipt ?? state.base ?? receipt).editDeadline}</Text>
    {state.previousOutcomeUnknown && <Notice title={t.history} />}
    {state.issue && <Notice kind="error" title={state.issue === "input" && !state.unresolved ? t.input : common.issue[state.issue === "input" ? "contract" : state.issue]} />}
    {(state.phase === "idle" || state.phase === "result") && <>
      <Text>{t.version}: {shown.version}</Text><Summary input={shown} locale={locale} /><Text>{common.response}: {common.status[shown.status]}</Text>
      {state.phase === "result" && state.input && <Notice title={t.saved} />}
      <Button label={t.begin} disabled={!model.canBegin(workflow, receipt)} onPress={() => model.begin(workflow, receipt)} />{!model.canBegin(workflow, receipt) && <Text secondary>{t.unavailable}</Text>}
    </>}
    {state.phase === "editing" && state.draft && <>
      <Text>{t.version}: {state.base?.version}</Text>
      <Rating label={common.overall} value={state.draft.overallRating} onSelect={v => model.setRating(id, "overallRating", v)} />
      {reviewDimensions.map(key => <Rating key={key} label={common.dimensions[key]} value={state.draft!.dimensions[key]} onSelect={v => model.setRating(id, key, v)} />)}
      <FormInput accessibilityLabel={common.comment} value={state.draft.comment} onChangeText={v => model.setText(id, "comment", v)} multiline maxLength={4000} />
      <FormInput accessibilityLabel={t.reason} value={state.reason} onChangeText={v => model.setText(id, "reason", v)} multiline maxLength={500} />
      <Stack row><Button label={t.review} onPress={() => model.prepare(workflow)} /><Button label={t.cancel} onPress={() => model.cancel(id)} /></Stack>
    </>}
    {!["idle", "editing", "result", "observed"].includes(state.phase) && state.input && <><Text>{t.version}: {state.input.version}</Text><Summary input={state.input} locale={locale} />{state.input.reason && <Text>{t.reason}: {state.input.reason}</Text>}</>}
    {state.phase === "prepared" && <><Text strong>{t.preview}</Text><Button label={t.confirm} tone="primary" disabled={!model.canConfirm(workflow)} onPress={() => { void model.confirm(workflow); }} /><Stack row><Button label={t.edit} onPress={() => model.edit(id)} /><Button label={t.cancel} onPress={() => model.cancel(id)} /></Stack></>}
    {state.phase === "pending" && <Loading label={t.pending} />}
    {state.phase === "checking" && <Loading label={t.checking} />}
    {state.unresolved && <Notice title={t.unknown} body={t.unknownBody} />}
    {state.observationMissing && <Notice title={t.missing} />}
    {model.canObserve(workflow) && <Button label={t.observe} onPress={() => { void model.observe(workflow); }} />}
    {state.phase === "observed" && state.receipt && <><Notice title={t.observed} body={t.observedBody} /><Text>{t.version}: {state.receipt.version}</Text><Summary input={state.receipt} locale={locale} /><Button label={t.acceptObserved} disabled={!model.canAcceptObserved(workflow)} onPress={() => model.acceptObserved(workflow)} /></>}
    {state.phase === "rejected" && (state.issue === "input" || state.issue === "throttled") && <Button label={t.edit} onPress={() => model.edit(id)} />}
  </Surface>;
}
