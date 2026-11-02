import { useSyncExternalStore } from "react";
import type { Locale } from "./format-wire";
import type { OrderConversationWindow } from "./order-conversation-read";
import type { OrderConversationDrafts } from "./order-conversation-draft";
import type { OrderConversationSend } from "./order-conversation-send";
import { OrderConversationDraftUi } from "./OrderConversationDraftUi";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
export const conversationSendCopy={
 ru:{preview:"Проверить перед отправкой",review:"Сообщение к отправке",audience:"Сообщение доступно сторонам диалога. При подключении поддержки его видят уполномоченные сотрудники.",text:"Текст к отправке",order:"Заказ",thread:"Диалог",party:"Собеседник",version:"Версия переписки при проверке",confirm:"Отправить в переписку",edit:"Вернуться к тексту",stale:"Переписка обновилась. Проверьте черновик заново.",pending:"Отправка сообщения",receipt:"Получен ответ об отправке",receiptBody:"Ответ указывает диалог. Перечитайте страницу, чтобы увидеть её текущее содержимое.",unknown:"Исход отправки не подтверждён",unknownBody:"Можно перечитать переписку и повторить исходную попытку.",rejected:"Попытка отклонена",read:"Перечитать страницу переписки",reading:"Читаем страницу переписки",readError:"Не удалось перечитать страницу",observed:"Получено текущее чтение страницы",observation:"Текущее содержимое не подтверждает исход предыдущей попытки отправки.",ack:"Учесть текущее чтение",replay:"Повторить исходную попытку",next:"Начать новое сообщение",key:"Не удалось подготовить попытку. Повторите подтверждение.",validation:"Источник отклонил данные сообщения",authentication:"Требуется повторный вход",denied:"Отправка недоступна для этого доступа",notFound:"Диалог недоступен",conflict:"Источник отклонил повтор с этим содержимым",invalidResult:"Ответ не подтвердил выбранный диалог",context:"Данные диалога изменились до получения ответа"},
 kk:{preview:"Жіберу алдында тексеру",review:"Жіберілетін хабарлама",audience:"Хабарлама диалог тараптарына қолжетімді. Қолдау қосылғанда оны уәкілетті қызметкерлер көреді.",text:"Жіберілетін мәтін",order:"Тапсырыс",thread:"Диалог",party:"Әңгімелесуші",version:"Тексеру кезіндегі хат алмасу нұсқасы",confirm:"Хат алмасуға жіберу",edit:"Мәтінге оралу",stale:"Хат алмасу жаңарды. Нобайды қайта тексеріңіз.",pending:"Хабарлама жіберілуде",receipt:"Жіберу туралы жауап алынды",receiptBody:"Жауап диалогты көрсетеді. Ағымдағы мазмұнын көру үшін бетті қайта оқыңыз.",unknown:"Жіберу нәтижесі расталмады",unknownBody:"Хат алмасуды қайта оқып, бастапқы әрекетті қайталауға болады.",rejected:"Әрекет қабылданбады",read:"Хат алмасу бетін қайта оқу",reading:"Хат алмасу беті оқылуда",readError:"Бетті қайта оқу мүмкін болмады",observed:"Беттің ағымдағы оқуы алынды",observation:"Ағымдағы мазмұн алдыңғы жіберу әрекетінің нәтижесін растамайды.",ack:"Ағымдағы оқуды ескеру",replay:"Бастапқы әрекетті қайталау",next:"Жаңа хабарламаны бастау",key:"Әрекетті дайындау мүмкін болмады. Растауды қайталаңыз.",validation:"Дереккөз хабарлама деректерін қабылдамады",authentication:"Қайта кіру қажет",denied:"Осы қолжетімділікпен жіберу мүмкін емес",notFound:"Диалог қолжетімсіз",conflict:"Дереккөз осы мазмұнмен қайталауды қабылдамады",invalidResult:"Жауап таңдалған диалогты растамады",context:"Жауап алынғанша диалог деректері өзгерді"},
} as const;
export function OrderConversationSendControls({model,drafts,window,locale}:{model:OrderConversationSend;drafts:OrderConversationDrafts;window:OrderConversationWindow;locale:Locale}){
 useSyncExternalStore(model.subscribe,model.getSnapshot,model.getSnapshot);
 const t=conversationSendCopy[locale],id=window.conversation?.id,state=id?model.stateFor(id):null,review=state?.review,authority=model.authorityIssue();
 const issue=state?.issue?(state.issue==="not-found"?t.notFound:state.issue==="invalid-result"?t.invalidResult:t[state.issue]):undefined;
 if(!id)return null;
 return <Stack><OrderConversationDraftUi model={drafts} window={window} locale={locale} locked={!!id&&model.blocksDraft(id)} onPrepare={model.canOffer(window)?()=>model.prepare(window):undefined} prepareLabel={t.preview}/>{authority?<Notice kind="error" title={authority==="authentication"?t.authentication:t.denied}/>:state&&state.phase!=="idle"&&<Surface>
 {review&&<Stack><Text strong>{t.review}</Text><Text>{`${t.order}: ${review.orderNumber}`}</Text><Text>{`${t.thread}: ${review.conversationTitle}`}</Text><Text>{`${t.party}: ${review.counterpartyName}`}</Text><Text>{`${t.version}: ${review.threadVersion}`}</Text><Text>{`${t.text}: ${review.body}`}</Text><Text secondary>{t.audience}</Text></Stack>}
 {issue&&<Notice kind="error" title={issue}/>}
 {state.phase==="prepared"&&review?<Stack>{!model.canConfirm(review)&&<Notice title={t.stale}/>}<Button label={t.edit} onPress={()=>model.edit(review)}/>{model.canConfirm(review)&&<Button label={t.confirm} onPress={()=>{void model.confirm(review);}}/>}</Stack>:null}
 {state.phase==="pending"&&<Notice title={t.pending}/>}
 {state.received&&<Notice title={t.receipt} body={t.receiptBody}/>}
 {state.unresolved&&<Notice title={t.unknown} body={t.unknownBody}/>}
 {state.phase==="rejected"&&!state.unresolved&&<Notice title={t.rejected}/>}
 {state.phase==="reading"&&<Notice title={t.reading}/>}
 {state.phase==="read-error"&&<Notice kind="error" title={t.readError}/>}
 {(state.phase==="review"||state.phase==="observed")&&<Notice title={t.observed} body={t.observation}/>}
 {id&&model.canRead(id)&&<Button label={t.read} onPress={()=>{void model.readCurrent(id);}}/>}
 {id&&model.canAcknowledge(id)&&<Button label={t.ack} onPress={()=>model.acknowledge(id)}/>}
 {id&&model.canReplay(id)&&<Button label={t.replay} onPress={()=>{void model.replay(id);}}/>}
 {model.canNewDraft(window)&&<Button label={t.next} onPress={()=>model.newDraft(window)}/>}
 </Surface>}</Stack>;
}
