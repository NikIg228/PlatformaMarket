import type { CartQuantityCommands } from "./cart-command-fixture";
import { CartQuantityCommandPanel, cartCommandCopy, nativeCartCommandCopy, useCartCommandState } from "./CartCommandUi";
import { DraftFormInput as FormInput } from "./DraftFormInput";
import { useRef, useSyncExternalStore } from "react";
import { ScrollView, StyleSheet } from "react-native";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { CartQuantityDrafts } from "./cart-quantity-draft";
import type { Locale } from "./format-wire";
import { copy, quantityDraftIssueText } from "./i18n";
import { Button, Notice, Stack, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";
export const nativeCartDraftBody={ru:"Ввод хранится в памяти сеанса. Проверка текста не отправляет изменение; сохранение выполняется отдельным действием.",kk:"Енгізу сеанс жадында сақталады. Мәтінді тексеру өзгерісті жібермейді; сақтау бөлек әрекетпен орындалады."} as const;
type Item = CartResponse["items"][number];
export function QuantityDraftRow({ store, cart, item, index, locale, onOpen }: { store: CartQuantityDrafts; cart: CartResponse; item: Item; index: number; locale: Locale; onOpen: () => void }) {
  const t = copy[locale];
  const draft = useSyncExternalStore(store.subscribe, () => store.getLine(cart, item), () => null);
  if (!store.canEdit(cart, item)) return null;
  const label = draft ? t.draftResume : t.draftOpen;
  return <Stack>{draft && <Text secondary>{t.draftPreview}: {draft.text || t.draftBlank}</Text>}<Button label={label} accessibilityLabel={`${label}: ${t.cartItem} ${index + 1}`} onPress={onOpen} /></Stack>;
}
export function QuantityDraftSummary({ store, locale, nativeCommands=false }: { store: CartQuantityDrafts; locale: Locale; nativeCommands?:boolean }) {
  const t = copy[locale], state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const count = Object.keys(state.entries).length;
  return <Stack>{state.discarded && <Notice title={t.draftDiscarded} body={t.draftDiscardedBody} />}
    {count > 0 && <><Text>{t.draftCount}: {count}</Text><Text secondary>{nativeCommands?nativeCartDraftBody[locale]:t.draftOnlyLocal}</Text><Button label={t.draftCancelAll} onPress={() => store.cancelAll()} /></>}
  </Stack>;
}
export function CartQuantityEditor({ store, cart, item, locale, onBack, command, onOriginalCart }: { onOriginalCart?: () => void; command?: CartQuantityCommands; store: CartQuantityDrafts; cart: CartResponse; item: Item; locale: Locale; onBack: () => void }) {
  const t = copy[locale], ref = useRef<FormInputHandle>(null);
  useCartCommandState(command); const locked = !!command?.isAvailable() && command.isLocked(cart.id);
  const draft = useSyncExternalStore(store.subscribe, () => store.getLine(cart, item), () => null);
  if (!draft) return <Stack><QuantityDraftUnavailable locale={locale} onBack={onBack} />{command && <CartQuantityCommandPanel onOriginalCart={onOriginalCart} command={command} cartId={cart.id} itemId={item.id} locale={locale} onInvalid={() => {}} onBack={onBack} />}</Stack>;
  const error = draft.checked && draft.issue ? quantityDraftIssueText(draft.issue, locale) : null;
  const check = () => { if (!store.check(cart, item)) ref.current?.focus(); };
  const operation = command?.stateFor(cart.id);
  if (command?.isAvailable() && operation?.operation === "remove" && operation.phase !== "idle" && operation.phase !== "observed") return <ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><CartQuantityCommandPanel onOriginalCart={onOriginalCart} command={command} cartId={cart.id} itemId={item.id} cart={cart} locale={locale} onInvalid={check} onBack={onBack} /><Button label={t.draftBack} onPress={onBack} /></ScrollView>;
  return <ScrollView contentContainerStyle={styles.editor} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Notice title={t.draftQuantityTitle} body={command?.runtime==="native-session"?nativeCartDraftBody[locale]:t.draftOnlyLocal} />
    <Text>{command?.isAvailable() ? `${(command?.runtime==="native-session"?nativeCartCommandCopy:cartCommandCopy)[locale].sourceQuantity} (${cart.version})` : t.draftServerQuantity}: {item.quantity}</Text>
    <FormInput draftSelection={{ owner: store, key: item.id, field: "quantity", readValue: () => store.getSnapshot().entries[item.id]?.text ?? null }} editable={!locked} ref={ref} autoFocus accessibilityLabel={t.draftQuantity} accessibilityHint={error ?? t.draftOnlyLocal} value={draft.text} keyboardType="decimal-pad" returnKeyType="done" onChangeText={text => store.change(cart, item, text)} onSubmitEditing={check} />
    {error && <Notice kind="error" title={t.draftError} body={error} />}
    {draft.checked && !draft.issue && <Notice title={t.draftChecked} body={command?.runtime==="native-session" && operation?.phase !== "idle" ? nativeCartDraftBody[locale] : t.draftOnlyLocal} />}
    <Button label={t.draftCheck} disabled={locked} onPress={check} /><Button label={t.draftBack} onPress={onBack} />
    {command && <CartQuantityCommandPanel onOriginalCart={onOriginalCart} command={command} cartId={cart.id} itemId={item.id} cart={cart} locale={locale} onInvalid={check} onBack={onBack} />}
    {!locked && command?.stateFor(cart.id).phase !== "prepared" && <Button label={t.draftCancel} onPress={() => { if (command?.isAvailable() && !command.cancelLocal(cart.id, item.id)) return; store.cancel(cart, item); onBack(); }} />}
  </ScrollView>;
}
export function QuantityDraftUnavailable({ locale, onBack }: { locale: Locale; onBack: () => void }) {
  const t = copy[locale];
  return <Notice title={t.draftSourceChanged} body={t.draftSourceChangedBody} action={<Button label={t.draftBack} onPress={onBack} />} />;
}
const styles = StyleSheet.create({ editor: { gap: theme.space.page, paddingBottom: theme.space.section } });
