import { withoutTestLabel } from "./native-command-copy";
import { useSyncExternalStore } from "react";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import type { CartWorkspaceCommands } from "./cart-workspace-command-fixture";
import { cartReadStatusLabel, copy } from "./i18n";
import { formatMinor, type Locale } from "./format-wire";
import { Button, Loading, Notice, Stack, Text } from "./ui/controls";

export const cartWorkspaceCommandCopy = {
  ru: {
    recoveryBoundary: "Восстановление корзины (тест)", recoveryBody: "Отправка на сервер отключена. Для неудачного оформления проверяется существующий сценарий восстановления состава. Цены, остатки, допуск и условия покупки требуют отдельной проверки.",
    recoveryStart: "Восстановить состав корзины (тест)", recoveryResult: "Ответ на восстановление (тест)", recoveryResultBody: "Ответ может вернуть прежнюю восстановленную корзину, уже изменённую или оформленную. Сохранённые суммы не подтверждают актуальность условий. Новое оформление, резерв и оплата здесь не выполняются.",
    recoveryUnknown: "Результат восстановления неизвестен", recoveryUnknownBody: "Успех не подтверждён. У этой операции постоянный ключ — исходная корзина. Можно явно повторить тот же запрос, чтобы получить её результат; новая версия или другой ключ автоматически не подставляются.",
    replayRecovery: "Повторить то же восстановление (тест)", recoverySource: "Исходная корзина этой попытки", expectedVersion: "Версия этой попытки",
    recoveryPrepare: "Проверить восстановление с прочитанной версией", recoveryPreparedBody: "Прочитанные источник и версия проверены. Восстановление ещё не отправлено; подтвердите действие отдельной кнопкой.", recoverySubmit: "Отправить проверенное восстановление (тест)",
    recoveryBlocked: "Сначала завершите работу с текущей корзиной. Её состав сохраняется отдельно.", recoverySourceUnavailable: "Для повтора нужно актуальное чтение той же исходной корзины после неудачного оформления.",
    boundary: "Создание или получение корзины (тест)", body: "Отправка на сервер отключена. Проверьте указанную валюту перед действием. Проверяется клиентский сценарий на подставном порте.",
    start: "Создать или получить корзину KZT (тест)", pending: "Ожидаем ответ по корзине", result: "Корзина из ответа (тест)",
    resultBody: "Ответ может содержать уже существующую корзину с товарами. Это не подтверждает оформление, цены, остатки или резерв. Перед покупкой нужна отдельная проверка условий.",
    openResult: "Открыть корзину из ответа", unknown: "Результат создания или получения неизвестен",
    unknownBody: "Автоматического повтора нет. Сначала прочитайте текущее состояние: прежняя корзина могла измениться или уже быть оформлена, а новая попытка может создать другую корзину.",
    rejected: "Корзина не получена", rejectedBody: "Запрос отклонён. Причину и доступ проверяет сервер. Перед новой попыткой прочитайте текущее состояние.",
    read: "Прочитать текущую корзину (тест)", readError: "Текущее состояние не подтверждено", review: "Сверка с текущим чтением",
    reviewBody: "Это отдельное чтение. Наличие или отсутствие активной корзины не доказывает результат прежней попытки.",
    current: "Активная корзина из чтения", none: "В этом чтении активной корзины нет", openCurrent: "Открыть активную корзину из чтения",
    prepare: "Подготовить новую попытку KZT", prepared: "Новая попытка подготовлена", preparedBody: "Запрос ещё не отправлен. Следующее действие — отдельная новая попытка создания или получения корзины с показанной валютой.",
    submit: "Отправить новую попытку KZT (тест)", returnReview: "Вернуться к сверке без отправки", acknowledge: "Принять текущее чтение",
    prior: "Предыдущая попытка осталась неподтверждённой", priorBody: "Новое чтение или ответ новой попытки не подтверждает результат прежней операции.",
    changed: "Страница корзин или контекст изменились", requestedCurrency: "Валюта запроса", id: "Корзина", version: "Версия по записи", currency: "Валюта по записи", item: "Позиция", quantity: "Количество по записи", unit: "Цена единицы по ответу", total: "Сумма позиции по ответу", empty: "В ответе нет позиций",
  },
  kk: {
    recoveryBoundary: "Себетті қалпына келтіру (тест)", recoveryBody: "Серверге жіберу өшірілген. Сәтсіз рәсімдеуден кейін құрамды қалпына келтірудің қолданыстағы сценарийі тексеріледі. Баға, қалдық, рұқсат және сатып алу шарттарын бөлек тексеру қажет.",
    recoveryStart: "Себет құрамын қалпына келтіру (тест)", recoveryResult: "Қалпына келтіру жауабы (тест)", recoveryResultBody: "Жауапта бұрын қалпына келтірілген, өзгертілген не рәсімделген себет қайтуы мүмкін. Сақталған сомалар шарттардың өзектілігін растамайды. Мұнда жаңа рәсімдеу, резерв пен төлем орындалмайды.",
    recoveryUnknown: "Қалпына келтіру нәтижесі белгісіз", recoveryUnknownBody: "Сәттілік расталмаған. Бұл операцияның тұрақты кілті — бастапқы себет. Нәтижесін алу үшін сол сұрауды анық қайталауға болады; жаңа нұсқа не басқа кілт автоматты қойылмайды.",
    replayRecovery: "Сол қалпына келтіруді қайталау (тест)", recoverySource: "Осы әрекеттің бастапқы себеті", expectedVersion: "Осы әрекеттің нұсқасы",
    recoveryPrepare: "Оқылған нұсқамен қалпына келтіруді тексеру", recoveryPreparedBody: "Оқылған бастапқы себет пен нұсқа тексерілді. Қалпына келтіру әлі жіберілмеген; әрекетті бөлек батырмамен растаңыз.", recoverySubmit: "Тексерілген қалпына келтіруді жіберу (тест)",
    recoveryBlocked: "Алдымен ағымдағы себетпен жұмысты аяқтаңыз. Оның құрамы бөлек сақталады.", recoverySourceUnavailable: "Қайталау үшін сәтсіз рәсімдеуден кейінгі сол бастапқы себеттің ағымдағы оқуы қажет.",
    boundary: "Себетті жасау немесе алу (тест)", body: "Серверге жіберу өшірілген. Әрекет алдында көрсетілген валютаны тексеріңіз. Клиент сценарийі жасанды портта тексеріледі.",
    start: "KZT себетін жасау немесе алу (тест)", pending: "Себет жауабын күтеміз", result: "Жауаптағы себет (тест)",
    resultBody: "Жауапта тауарлары бар бұрыннан бар себет болуы мүмкін. Бұл рәсімдеуді, бағаны, қалдықты не резервті растамайды. Сатып алу алдында шарттарды бөлек тексеру қажет.",
    openResult: "Жауаптағы себетті ашу", unknown: "Себетті жасау немесе алу нәтижесі белгісіз",
    unknownBody: "Автоматты қайталау жоқ. Алдымен ағымдағы күйді оқыңыз: бұрынғы себет өзгеруі не рәсімделуі мүмкін, ал жаңа әрекет басқа себет жасауы мүмкін.",
    rejected: "Себет алынбады", rejectedBody: "Сұрау қабылданбады. Себеп пен қолжетімділікті сервер тексереді. Жаңа әрекет алдында ағымдағы күйді оқыңыз.",
    read: "Ағымдағы себетті оқу (тест)", readError: "Ағымдағы күй расталмаған", review: "Ағымдағы оқумен салыстыру",
    reviewBody: "Бұл бөлек оқу. Белсенді себеттің болуы не болмауы бұрынғы әрекет нәтижесін дәлелдемейді.",
    current: "Оқудағы белсенді себет", none: "Осы оқуда белсенді себет жоқ", openCurrent: "Оқудағы белсенді себетті ашу",
    prepare: "Жаңа KZT әрекетін дайындау", prepared: "Жаңа әрекет дайындалды", preparedBody: "Сұрау әлі жіберілмеген. Келесі қадам — көрсетілген валютада себет жасау не алудың бөлек жаңа әрекеті.",
    submit: "Жаңа KZT әрекетін жіберу (тест)", returnReview: "Жібермей салыстыруға оралу", acknowledge: "Ағымдағы оқуды қабылдау",
    prior: "Алдыңғы әрекет расталмаған күйде қалды", priorBody: "Жаңа оқу не жаңа әрекет жауабы бұрынғы операция нәтижесін растамайды.",
    changed: "Себеттер беті не контекст өзгерді", requestedCurrency: "Сұрау валютасы", id: "Себет", version: "Жазбадағы нұсқа", currency: "Жазбадағы валюта", item: "Позиция", quantity: "Жазбадағы мөлшер", unit: "Жауаптағы бірлік бағасы", total: "Жауаптағы позиция сомасы", empty: "Жауапта позициялар жоқ",
  },
} as const;
export const nativeCartWorkspaceCommandCopy={ru:{...withoutTestLabel(cartWorkspaceCommandCopy.ru),body:"Проверьте валюту. Запрос создаёт корзину или возвращает существующую активную корзину этой валюты.",recoveryBody:"Восстанавливается состав неудачной корзины. Перед оформлением заново проверьте цены, наличие и условия. Существующая непустая корзина не заменяется."},kk:{...withoutTestLabel(cartWorkspaceCommandCopy.kk),body:"Валютаны тексеріңіз. Сұрау себетті құрады немесе осы валютадағы бар белсенді себетті қайтарады.",recoveryBody:"Сәтсіз себеттің құрамы қалпына келтіріледі. Рәсімдеу алдында бағаны, қолжетімділікті және шарттарды қайта тексеріңіз. Бар бос емес себет ауыстырылмайды."}} as const;
export function cartCreateStartLabel(locale: Locale, currency: string, native=false): string { const t=(native?nativeCartWorkspaceCommandCopy:cartWorkspaceCommandCopy)[locale]; return currency === "KZT" ? t.start : locale === "ru" ? `Создать или получить корзину ${currency}${native?"":" (тест)"}` : `${currency} себетін жасау немесе алу${native?"":" (тест)"}`; }
export function cartCreatePrepareLabel(locale: Locale, currency: string): string { return currency === "KZT" ? cartWorkspaceCommandCopy[locale].prepare : locale === "ru" ? `Подготовить новую попытку ${currency}` : `Жаңа ${currency} әрекетін дайындау`; }
export function cartCreateSubmitLabel(locale: Locale, currency: string, native=false): string { const t=(native?nativeCartWorkspaceCommandCopy:cartWorkspaceCommandCopy)[locale]; return currency === "KZT" ? t.submit : locale === "ru" ? `Отправить новую попытку ${currency}${native?"":" (тест)"}` : `${currency} әрекетін жіберу${native?"":" (тест)"}`; }
const none = Object.freeze({}); const getNone = () => none; const noSubscribe = () => () => {};
export function useCartWorkspaceCommandState(command?: CartWorkspaceCommands) {
  return useSyncExternalStore(command?.subscribe ?? noSubscribe, command?.getSnapshot ?? getNone, command?.getSnapshot ?? getNone);
}
function CartFacts({ cart, locale }: { cart: CartResponse; locale: Locale }) {
  const t = cartWorkspaceCommandCopy[locale];
  return <Stack><Text>{t.id}: {cart.id}</Text><Text>{t.version}: {cart.version}</Text><Text>{t.currency}: {cart.currency}</Text><Text>{copy[locale].cartState}: {cartReadStatusLabel(cart.status, locale)}</Text>
    {!cart.items.length && <Text>{t.empty}</Text>}
    {cart.items.map((item, index) => <Stack key={item.id}><Text>{t.item} {index + 1}</Text><Text>{t.quantity}: {item.quantity}</Text><Text>{t.unit}: {formatMinor(item.unitPriceMinor, item.currency, locale) ?? copy[locale].priceUnknown}</Text><Text>{t.total}: {formatMinor(item.totalPriceMinor, item.currency, locale) ?? copy[locale].priceUnknown}</Text></Stack>)}
  </Stack>;
}
export function CartRecoveryAction({ command, page, source, index, locale }: { command: CartWorkspaceCommands; page: WorkspaceCartPage; source: CartResponse; index: number; locale: Locale }) {
  useCartWorkspaceCommandState(command);
  if (!command.isRecoveryAvailable() || source.status !== "ABANDONED" || source.checkout?.status !== "FAILED" || source.recoveredCartId) return null;
  const t = (command.runtime === "native-session" ? nativeCartWorkspaceCommandCopy : cartWorkspaceCommandCopy)[locale];
  return <Stack>{command.currentWorkBlocksRecovery(page) && <Notice title={t.recoveryBlocked} />}<Button label={t.recoveryStart} accessibilityLabel={`${t.recoveryStart}: ${copy[locale].savedCart} ${index + 1}`} disabled={!command.canStartRecovery(page, source)} onPress={() => { void command.startRecovery(page, source); }} /></Stack>;
}
export function CartWorkspaceCommandPanel({ command, page, locale, onResult, onCurrent, currencyHint }: { command: CartWorkspaceCommands; page?: WorkspaceCartPage; locale: Locale; onResult?: (cart: CartResponse) => void; onCurrent?: (cartId: string) => void; currencyHint?: string }) {
  useCartWorkspaceCommandState(command);
  if (!command.isAvailable()) return null;
  const state = command.getSnapshot(), t = (command.runtime === "native-session" ? nativeCartWorkspaceCommandCopy : cartWorkspaceCommandCopy)[locale], recovery = state.operation === "recover" || !command.isCreateAvailable();
  const currency = state.operation === "create" && state.input && "currency" in state.input ? state.input.currency : currencyHint ?? "KZT";
  return <Stack><Notice title={recovery ? t.recoveryBoundary : t.boundary} body={recovery ? t.recoveryBody : t.body} />
    {!recovery && <Text>{t.requestedCurrency}: {currency}</Text>}
    {state.operation === "recover" && state.sourceCartId && <Text>{t.recoverySource}: {state.sourceCartId}</Text>}
    {state.operation === "recover" && state.input && "expectedVersion" in state.input && <Text>{t.expectedVersion}: {state.input.expectedVersion}</Text>}
    {state.priorUnknown && <Notice title={t.prior} body={t.priorBody} />}
    {(command.isCreateAvailable() && page && ["idle", "observed"].includes(state.phase) && page.current === null) && <Button label={cartCreateStartLabel(locale, currency, command.runtime === "native-session")} disabled={!command.canStart(page)} onPress={() => { void command.start(page, currency); }} />}
    {(state.phase === "pending" || state.phase === "reading") && <Loading label={t.pending} />}
    {state.phase === "unknown" && <Notice kind="error" title={state.operation === "recover" ? t.recoveryUnknown : t.unknown} body={state.operation === "recover" ? t.recoveryUnknownBody : t.unknownBody} />}
    {state.phase === "rejected" && <Notice kind="error" title={t.rejected} body={t.rejectedBody} />}
    {state.phase === "read-error" && <Notice kind="error" title={t.readError} body={state.operation === "recover" ? t.recoveryUnknownBody : t.unknownBody} />}
    {state.phase === "result" && state.result && <><Notice title={state.operation === "recover" ? t.recoveryResult : t.result} body={state.operation === "recover" ? t.recoveryResultBody : t.resultBody} /><CartFacts cart={state.result} locale={locale} />{onResult && <Button label={t.openResult} disabled={command.resultCart() !== state.result} onPress={() => onResult(state.result!)} />}</>}
    {state.phase === "review" && state.latest && <><Notice title={t.review} body={t.reviewBody} />{state.latest.current ? <><Text strong>{t.current}</Text><CartFacts cart={state.latest.current} locale={locale} />{onCurrent && <Button label={t.openCurrent} disabled={state.latest !== page} onPress={() => onCurrent(state.latest!.current!.id)} />}</> : <Text>{t.none}</Text>}{command.canPrepare() && <Button label={state.operation === "recover" ? t.recoveryPrepare : cartCreatePrepareLabel(locale, currency)} onPress={() => command.prepareNew()} />}<Button label={t.acknowledge} disabled={!command.canAcknowledge()} onPress={() => command.acknowledge()} /></>}
    {state.phase === "prepared" && <><Notice title={t.prepared} body={state.operation === "recover" ? t.recoveryPreparedBody : t.preparedBody} />{!command.canSubmitPrepared() && <Notice kind="error" title={t.changed} />}<Button label={state.operation === "recover" ? t.recoverySubmit : cartCreateSubmitLabel(locale, currency, command.runtime === "native-session")} disabled={!command.canSubmitPrepared()} onPress={() => { void command.submitPrepared(); }} /><Button label={t.returnReview} onPress={() => command.returnToReview()} /></>}
    {state.operation === "recover" && ["unknown", "read-error", "review"].includes(state.phase) && command.hasUnresolvedRecovery() && (command.canReplayRecovery() ? <Button label={t.replayRecovery} onPress={() => { void command.replayRecovery(); }} /> : <Notice title={t.recoverySourceUnavailable} />)}
    {command.canRead() && <Button label={t.read} onPress={() => { void command.readCurrent(); }} />}
  </Stack>;
}
