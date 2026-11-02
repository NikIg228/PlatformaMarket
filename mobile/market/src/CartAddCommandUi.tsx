import { withoutTestLabel } from "./native-command-copy";
import { useSyncExternalStore } from "react";
import type { OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import type { CartAddCommands } from "./cart-add-command-fixture";
import type { CartAddQuantityIssue } from "./cart-add-quantity";
import type { LocalListDraft, LocalListTarget } from "./local-list-draft";
import { formatMinor, type Locale } from "./format-wire";
import { copy, quantityDraftIssueText } from "./i18n";
import { Button, Loading, Notice, Stack, Text } from "./ui/controls";

export const cartAddCopy = {
  ru: {
    choose: "Перейти к корзине с этим количеством (тест)", readOffer: "Прочитать исходное предложение для корзины", chooseBody: "Сначала проверьте количество, затем состав текущей корзины. Текст черновика сохранится при переходе.",
    unavailable: "Исходное предложение не подтверждено", availability: "В исходном чтении нет положительного наличия предложения", rules: "Минимум и кратность исходного предложения не подтверждены",
    minimumError: (minimum: string) => `Количество должно быть не меньше ${minimum}.`,
    stepError: (minimum: string, step: string) => `Количество должно отличаться от минимума ${minimum} на целое число шагов ${step}.`,
    boundary: "Добавление предложения в корзину (тест)", body: "Отправка на сервер отключена. Показаны условия исходного чтения; актуальные цену, наличие и допуск проверяет сервер при добавлении.",
    product: "Товар из исходного чтения", supplier: "Поставщик из исходного чтения", packaging: "Упаковка из исходного чтения", currency: "Валюта предложения", cartCurrency: "Валюта прочитанной корзины", minimum: "Минимум по исходному чтению", step: "Шаг от минимума", raw: "Сохранённый ввод количества", requested: "Количество этой попытки", sourceVersion: "Версия корзины в исходном чтении", attemptedCart: "Корзина этой попытки",
    replaces: "Количество этого предложения в корзине будет заменено указанным количеством. Прибавления к прежнему количеству нет.", existing: "Количество предложения в прочитанной корзине", notPresent: "В прочитанной корзине этого предложения нет", ambiguous: "Позиция предложения в чтении неоднозначна",
    apply: "Установить это количество предложения в корзине (тест)", pending: "Ожидаем ответ по позиции корзины", needsCart: "Нужна активная корзина с валютой предложения", cartUnavailable: "Прочитанная корзина не подходит для этой попытки", choiceChanged: "Исходное предложение или количество в черновике изменились", discard: "Отменить подготовку добавления",
    unknown: "Результат добавления неизвестен", unknownBody: "Слепого повтора нет. Прочитайте текущую корзину, проверьте предложение и количество, затем отдельно подготовьте новую попытку.", rejected: "Позиция не принята", rejectedBody: "Запрос отклонён. Условия, доступ и наличие проверяет сервер. Прочитайте текущее состояние перед новой попыткой.",
    result: "Получен ответ по позиции (тест)", resultBody: "Показана позиция из ответа. Перед следующим изменением прочитайте текущее состояние корзины.", resultQuantity: "Количество по ответу", unit: "Цена единицы по ответу", total: "Сумма позиции по ответу", open: "Открыть корзину", read: "Прочитать текущую корзину для сверки (тест)", readError: "Текущее состояние не подтверждено",
    review: "Сверка с текущим чтением", reviewBody: "Совпавшее количество в отдельном чтении не доказывает результат прежней попытки. Новая отправка требует отдельной проверки и действия.", currentCart: "Текущая корзина по чтению", version: "Версия по чтению", noCurrent: "В этом чтении активной корзины нет", otherCart: "Активная корзина изменилась. Новая попытка будет относиться к прочитанной корзине.", prepare: "Проверить новую попытку для прочитанной корзины", prepared: "Новая попытка проверена", preparedBody: "Предложение и сохранённое количество подготовлены для показанной корзины. Запрос ещё не отправлен.", submit: "Отправить проверенное добавление (тест)", returnReview: "Вернуться к сверке без отправки", acknowledge: "Принять текущее чтение", prior: "Предыдущая попытка осталась неподтверждённой", priorBody: "Новый ответ или чтение не подтверждает результат прежней операции.",
  },
  kk: {
    choose: "Осы мөлшермен себетке өту (тест)", readOffer: "Себет үшін бастапқы ұсынысты оқу", chooseBody: "Алдымен мөлшерді, содан кейін ағымдағы себет құрамын тексеріңіз. Ауысқанда жоба мәтіні сақталады.",
    unavailable: "Бастапқы ұсыныс расталмаған", availability: "Бастапқы оқуда ұсыныстың оң қалдығы жоқ", rules: "Бастапқы ұсыныстың минимумы мен қадамы расталмаған",
    minimumError: (minimum: string) => `Мөлшер ${minimum} мәнінен кем болмауы тиіс.`,
    stepError: (minimum: string, step: string) => `Мөлшер ${minimum} минимумынан ${step} қадамының бүтін санына айырылуы тиіс.`,
    boundary: "Ұсынысты себетке қосу (тест)", body: "Серверге жіберу өшірілген. Бастапқы оқу шарттары көрсетілген; қосу кезінде өзекті баға, қалдық пен рұқсатты сервер тексереді.",
    product: "Бастапқы оқудағы тауар", supplier: "Бастапқы оқудағы жеткізуші", packaging: "Бастапқы оқудағы қаптама", currency: "Ұсыныс валютасы", cartCurrency: "Оқылған себет валютасы", minimum: "Бастапқы оқудағы минимум", step: "Минимумнан басталатын қадам", raw: "Сақталған мөлшер енгізуі", requested: "Осы әрекеттің мөлшері", sourceVersion: "Бастапқы оқудағы себет нұсқасы", attemptedCart: "Осы әрекеттің себеті",
    replaces: "Себеттегі осы ұсыныстың мөлшері көрсетілген мөлшерге ауыстырылады. Бұрынғы мөлшерге қосылмайды.", existing: "Оқылған себеттегі ұсыныс мөлшері", notPresent: "Оқылған себетте осы ұсыныс жоқ", ambiguous: "Оқудағы ұсыныс позициясы бірмәнді емес",
    apply: "Ұсыныстың осы мөлшерін себетке қою (тест)", pending: "Себет позициясының жауабын күтеміз", needsCart: "Ұсыныс валютасындағы белсенді себет қажет", cartUnavailable: "Оқылған себет бұл әрекетке сәйкес келмейді", choiceChanged: "Бастапқы ұсыныс не жобадағы мөлшер өзгерді", discard: "Қосуды дайындаудан бас тарту",
    unknown: "Қосу нәтижесі белгісіз", unknownBody: "Тексерусіз қайталау жоқ. Ағымдағы себетті оқып, ұсыныс пен мөлшерді тексеріңіз, содан кейін жаңа әрекетті бөлек дайындаңыз.", rejected: "Позиция қабылданбады", rejectedBody: "Сұрау қабылданбады. Шарттар, қолжетімділік пен қалдықты сервер тексереді. Жаңа әрекет алдында ағымдағы күйді оқыңыз.",
    result: "Позиция жауабы алынды (тест)", resultBody: "Жауаптағы позиция көрсетілген. Келесі өзгеріс алдында себеттің ағымдағы күйін оқыңыз.", resultQuantity: "Жауаптағы мөлшер", unit: "Жауаптағы бірлік бағасы", total: "Жауаптағы позиция сомасы", open: "Себетті ашу", read: "Салыстыру үшін ағымдағы себетті оқу (тест)", readError: "Ағымдағы күй расталмаған",
    review: "Ағымдағы оқумен салыстыру", reviewBody: "Бөлек оқудағы бірдей мөлшер бұрынғы әрекеттің нәтижесін дәлелдемейді. Жаңа жіберу бөлек тексеру мен әрекетті қажет етеді.", currentCart: "Оқудағы ағымдағы себет", version: "Оқудағы нұсқа", noCurrent: "Осы оқуда белсенді себет жоқ", otherCart: "Белсенді себет өзгерді. Жаңа әрекет оқылған себетке қатысты болады.", prepare: "Оқылған себет үшін жаңа әрекетті тексеру", prepared: "Жаңа әрекет тексерілді", preparedBody: "Ұсыныс пен сақталған мөлшер көрсетілген себетке дайындалды. Сұрау әлі жіберілмеген.", submit: "Тексерілген қосуды жіберу (тест)", returnReview: "Жібермей салыстыруға оралу", acknowledge: "Ағымдағы оқуды қабылдау", prior: "Алдыңғы әрекет расталмаған күйде қалды", priorBody: "Жаңа жауап не оқу бұрынғы операция нәтижесін растамайды.",
  },
} as const;
export const nativeCartAddCopy={ru:{...withoutTestLabel(cartAddCopy.ru),body:"В корзине будет установлено указанное количество выбранного предложения. При добавлении сервер проверяет актуальные цену, наличие и доступ."},kk:{...withoutTestLabel(cartAddCopy.kk),body:"Себетте таңдалған ұсыныстың көрсетілген мөлшері орнатылады. Қосу кезінде сервер өзекті бағаны, қолжетімділікті және рұқсатты тексереді."}} as const;
export function cartAddQuantityIssueText(issue: CartAddQuantityIssue, locale: Locale): string {
  if (issue.kind === "offer-minimum") return cartAddCopy[locale].minimumError(issue.minimum);
  if (issue.kind === "offer-step") return cartAddCopy[locale].stepError(issue.minimum, issue.step);
  return quantityDraftIssueText(issue, locale);
}
export function cartAddQuantityErrorFor(command: CartAddCommands, list: LocalListDraft, target: LocalListTarget, locale: Locale): string | null {
  if (!command.isAvailable()) return null;
  const state = command.getSnapshot(), entry = list.entryFor(target);
  return state.selectionTarget === target && state.quantityIssue && entry?.quantityText === state.checkedRaw ? cartAddQuantityIssueText(state.quantityIssue, locale) : null;
}
const none = Object.freeze({}); const getNone = () => none; const noSubscribe = () => () => {};
export function useCartAddCommandState(command?: CartAddCommands) { return useSyncExternalStore(command?.subscribe ?? noSubscribe, command?.getSnapshot ?? getNone, command?.getSnapshot ?? getNone); }

export function CartAddFromListAction({ command, list, target, comparison, locale, onSelected, onQuantityError, onReadSource }: { command: CartAddCommands; list: LocalListDraft; target: LocalListTarget; comparison?: OfferComparisonResponse; locale: Locale; onSelected: () => void; onQuantityError: () => void; onReadSource: () => void }) {
  useCartAddCommandState(command); useSyncExternalStore(list.subscribe, list.getSnapshot, list.getSnapshot);
  if (!command.isAvailable()) return null;
  const t = (command.runtime === "native-session" ? nativeCartAddCopy : cartAddCopy)[locale], state = command.getSnapshot(), own = state.selectionTarget === target;
  if (!comparison || comparison.product.id !== target.productId || comparison.selectedVariantId !== target.variantId) return <Button label={t.readOffer} onPress={onReadSource} />;
  const error = cartAddQuantityErrorFor(command, list, target, locale);
  const sourceError = own && state.selectionIssue ? state.selectionIssue === "availability" ? t.availability : state.selectionIssue === "rules" ? t.rules : t.unavailable : null;
  return <Stack><Text secondary>{t.chooseBody}</Text>{error && <Notice kind="error" title={copy[locale].localListQuantity} body={error} />}{sourceError && <Notice kind="error" title={t.unavailable} body={sourceError} />}
    <Button label={t.choose} disabled={!command.canChoose(target)} onPress={() => { const result = command.select(target, comparison); if (result === "quantity") onQuantityError(); else if (result === "selected") onSelected(); }} />
  </Stack>;
}

export function CartAddCommandPanel({ command, page, locale, onCart }: { command: CartAddCommands; page?: WorkspaceCartPage; locale: Locale; onCart?: (id: string) => void }) {
  useCartAddCommandState(command);
  if (!command.isAvailable()) return null;
  const state = command.getSnapshot(), t = (command.runtime === "native-session" ? nativeCartAddCopy : cartAddCopy)[locale], choice = state.choice;
  if (!choice && !state.priorUnknown) return null;
  const current = state.latest?.current, rows = current && choice ? current.items.filter(item => item.offerId === choice.target.offerId) : [], existing = page ? command.existingQuantity(page) : undefined;
  const sourceRows = page?.current && choice ? page.current.items.filter(item => item.offerId === choice.target.offerId) : [], input = state.input ?? choice?.input;
  const resultCart = command.resultCartId();
  return <Stack><Notice title={t.boundary} body={t.body} />{state.priorUnknown && <Notice title={t.prior} body={t.priorBody} />}
    {choice && <><Text>{t.product}: {choice.productName}</Text><Text>{t.supplier}: {choice.supplierName}</Text><Text>{t.packaging}: {choice.packagingName}</Text><Text>{t.currency}: {choice.currency}</Text><Text>{t.minimum}: {choice.minimum}</Text><Text>{t.step}: {choice.increment}</Text><Text>{t.raw}: {choice.raw}</Text></>}
    {input && <Text>{t.requested}: {input.quantity}</Text>}{state.attemptedCartId && <Text>{t.attemptedCart}: {state.attemptedCartId}</Text>}{state.sourceVersion !== undefined && <Text>{t.sourceVersion}: {state.sourceVersion}</Text>}
    {choice && ["selected", "observed"].includes(state.phase) && <>
      {!command.sourceIsCurrent() && <Notice kind="error" title={t.choiceChanged} />}
      {page?.current && <><Text>{t.currentCart}: {page.current.id}</Text><Text>{t.cartCurrency}: {page.current.currency}</Text><Text>{t.version}: {page.current.version}</Text></>}
      {page && !page.current && <Notice title={t.needsCart} body={choice.currency} />}
      {page?.current && (page.current.currency !== choice.currency || page.current.status !== "ACTIVE" || page.current.checkout !== null) && <Notice title={t.cartUnavailable} />}
      {existing !== undefined ? <><Text>{t.existing}: {existing}</Text><Notice title={t.replaces} /></> : sourceRows.length > 1 ? <Text>{t.ambiguous}</Text> : page?.current?.currency === choice.currency && sourceRows.length === 0 ? <Text>{t.notPresent}</Text> : null}
      {page?.current && <Button label={t.apply} disabled={!command.canSubmit(page)} onPress={() => { void command.submit(page); }} />}<Button label={t.discard} onPress={() => command.discard()} />
    </>}
    {(state.phase === "pending" || state.phase === "reading") && <Loading label={t.pending} />}
    {state.phase === "unknown" && <Notice kind="error" title={t.unknown} body={t.unknownBody} />}
    {state.phase === "rejected" && <Notice kind="error" title={t.rejected} body={t.rejectedBody} />}
    {state.phase === "read-error" && <Notice kind="error" title={t.readError} body={t.unknownBody} />}
    {state.phase === "result" && state.result && <><Notice title={t.result} body={t.resultBody} /><Text>{t.resultQuantity}: {state.result.quantity}</Text><Text>{t.unit}: {formatMinor(state.result.unitPriceMinor, state.result.currency, locale) ?? copy[locale].priceUnknown}</Text><Text>{t.total}: {formatMinor(state.result.totalPriceMinor, state.result.currency, locale) ?? copy[locale].priceUnknown}</Text>{onCart && resultCart && <Button label={t.open} onPress={() => onCart(resultCart)} />}</>}
    {state.phase === "review" && state.latest && <><Notice title={t.review} body={t.reviewBody} />{current ? <><Text>{t.currentCart}: {current.id}</Text><Text>{t.version}: {current.version}</Text>{state.attemptedCartId && state.attemptedCartId !== current.id && <Notice title={t.otherCart} />}{rows?.length === 1 ? <Text>{t.existing}: {rows[0]!.quantity}</Text> : <Text>{rows && rows.length > 1 ? t.ambiguous : t.notPresent}</Text>}</> : <Text>{t.noCurrent}</Text>}{command.canPrepare() && <Button label={t.prepare} onPress={() => command.prepareNew()} />}<Button label={t.acknowledge} disabled={!command.canAcknowledge()} onPress={() => command.acknowledge()} /></>}
    {state.phase === "prepared" && <><Notice title={t.prepared} body={t.preparedBody} /><Button label={t.submit} disabled={!command.canSubmitPrepared()} onPress={() => { void command.submitPrepared(); }} /><Button label={t.returnReview} onPress={() => command.returnToReview()} /></>}
    {command.canRead() && <Button label={t.read} onPress={() => { void command.readCurrent(); }} />}
  </Stack>;
}
