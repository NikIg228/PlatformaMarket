import { useRef } from "react";
import { StyleSheet } from "react-native";
import type { OrderConversationEscalate } from "./order-conversation-escalate";
import type { OrderConversationWindow } from "./order-conversation-read";
import type { Locale } from "./format-wire";
import { DraftFormInput } from "./DraftFormInput";
import { Button, Notice, Stack, Surface, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";
export const conversationEscalateCopy={
  "ru": {
    "start": "Обратиться в поддержку по диалогу",
    "resume": "Продолжить обращение по диалогу",
    "title": "Причина обращения по диалогу",
    "local": "Текст сохранён в памяти на время этой сессии. Это ещё не отправка.",
    "body": "Причина обращения к поддержке",
    "check": "Проверить причину обращения",
    "checked": "Причина проверена. Запрос не отправлен.",
    "pause": "Свернуть причину обращения",
    "discard": "Удалить черновик причины",
    "error": "Проверьте причину обращения",
    "too-short": "Введите не менее 10 символов после удаления пробелов по краям",
    "too-long": "Не более 2000 символов после удаления пробелов по краям",
    "format": "Не удалось проверить причину",
    "preview": "Проверить обращение перед отправкой",
    "review": "Обращение к поддержке по этому диалогу",
    "wire": "Причина к отправке",
    "order": "Заказ",
    "audience": "Поддержка получит запрос по этому диалогу. Если обращение уже открыто, источник вернёт его; новая причина может не добавиться.",
    "confirm": "Отправить обращение по диалогу",
    "edit": "Вернуться к причине обращения",
    "stale": "Диалог обновился. Проверьте обращение заново.",
    "pending": "Отправка обращения по диалогу",
    "result": "Ответ получен. Нужно проверить связь обращения",
    "resultBody": "Перечитайте исходный диалог, чтобы проверить указатель на обращение. Данные обращения читаются отдельно.",
    "receipt": "Связь ответа с диалогом проверена",
    "receiptBody": "Источник диалога указывает на возвращённое обращение. Состояние диалога показано по источнику; данные обращения открываются отдельно. Это не подтверждает добавление новой причины.",
    "unknown": "Исход обращения по диалогу не подтверждён",
    "unknownBody": "Можно перечитать исходный диалог или повторить ту же попытку с неизменной причиной.",
    "rejected": "Попытка обращения по диалогу отклонена",
    "read": "Проверить обращение через диалог",
    "reading": "Читаем диалог для проверки обращения",
    "readError": "Не удалось проверить связь обращения с диалогом",
    "observed": "Получено текущее чтение диалога",
    "observation": "Совпадающее обращение или текст в текущем чтении не доказывают исход старой неподтверждённой попытки.",
    "ack": "Учесть проверку обращения по диалогу",
    "replay": "Повторить исходное обращение по диалогу",
    "finish": "Завершить проверку обращения",
    "key": "Не удалось подготовить попытку. Повторите подтверждение.",
    "validation": "Источник отклонил причину обращения",
    "authentication": "Для обращения нужен повторный вход",
    "denied": "Обращение к поддержке недоступно",
    "notFound": "Связанное обращение пока не подтверждено",
    "conflict": "Источник отклонил повтор с этим содержимым",
    "invalidResult": "Ответ не подтвердил обращение выбранного диалога",
    "context": "Данные диалога изменились до ответа",
    "paused": "Черновик причины сохранён",
    "active": "Поддержка уже рассматривает вопрос. Откройте связанное обращение, чтобы прочитать его или ответить."
  },
  "kk": {
    "start": "Диалог бойынша қолдауға жүгіну",
    "resume": "Диалог өтінішін жалғастыру",
    "title": "Диалог өтінішінің себебі",
    "local": "Мәтін осы сессия уақытына жадта сақталған. Бұл әлі жіберу емес.",
    "body": "Қолдауға жүгіну себебі",
    "check": "Өтініш себебін тексеру",
    "checked": "Себеп тексерілді. Сұрау жіберілген жоқ.",
    "pause": "Өтініш себебін жию",
    "discard": "Себеп нобайын жою",
    "error": "Өтініш себебін тексеріңіз",
    "too-short": "Шеткі бос орындарды алып тастағаннан кейін кемінде 10 таңба енгізіңіз",
    "too-long": "Шеткі бос орындарды алып тастағаннан кейін 2000 таңбадан аспайды",
    "format": "Себепті тексеру мүмкін болмады",
    "preview": "Өтінішті жіберу алдында тексеру",
    "review": "Осы диалог бойынша қолдауға өтініш",
    "wire": "Жіберілетін себеп",
    "order": "Тапсырыс",
    "audience": "Қолдау осы диалог бойынша сұрау алады. Өтініш ашық болса, дереккөз соны қайтарады; жаңа себеп қосылмауы мүмкін.",
    "confirm": "Диалог өтінішін жіберу",
    "edit": "Өтініш себебіне оралу",
    "stale": "Диалог жаңарды. Өтінішті қайта тексеріңіз.",
    "pending": "Диалог өтініші жіберілуде",
    "result": "Жауап алынды. Өтініш байланысын тексеру қажет",
    "resultBody": "Өтініш сілтемесін тексеру үшін бастапқы диалогты қайта оқыңыз. Өтініш деректері бөлек оқылады.",
    "receipt": "Жауаптың диалогпен байланысы тексерілді",
    "receiptBody": "Диалог дереккөзі қайтарылған өтінішті көрсетеді. Диалог күйі дереккөз бойынша көрсетіледі; өтініш деректері бөлек ашылады. Бұл жаңа себеп қосылғанын растамайды.",
    "unknown": "Диалог өтінішінің нәтижесі расталмады",
    "unknownBody": "Бастапқы диалогты қайта оқуға немесе өзгермеген себеппен сол әрекетті қайталауға болады.",
    "rejected": "Диалог өтінішінің әрекеті қабылданбады",
    "read": "Өтінішті диалог арқылы тексеру",
    "reading": "Өтінішті тексеру үшін диалог оқылуда",
    "readError": "Өтініштің диалогпен байланысын тексеру мүмкін болмады",
    "observed": "Диалогтың ағымдағы оқуы алынды",
    "observation": "Ағымдағы оқудағы сәйкес өтініш немесе мәтін ескі расталмаған әрекеттің нәтижесін дәлелдемейді.",
    "ack": "Диалог өтінішінің тексеруін ескеру",
    "replay": "Бастапқы диалог өтінішін қайталау",
    "finish": "Өтініш тексеруін аяқтау",
    "key": "Әрекетті дайындау мүмкін болмады. Растауды қайталаңыз.",
    "validation": "Дереккөз өтініш себебін қабылдамады",
    "authentication": "Өтініш үшін қайта кіру қажет",
    "denied": "Қолдауға жүгіну қолжетімсіз",
    "notFound": "Байланысты өтініш әлі расталмады",
    "conflict": "Дереккөз осы мазмұнмен қайталауды қабылдамады",
    "invalidResult": "Жауап таңдалған диалог өтінішін растамады",
    "context": "Жауап алынғанша диалог деректері өзгерді",
    "paused": "Себеп нобайы сақталған",
    "active": "Қолдау сұрақты қарап жатыр. Оқу немесе жауап беру үшін байланысты өтінішті ашыңыз."
  }
} as const;
export function OrderConversationEscalateUi({model,window,locale}:{model:OrderConversationEscalate;window:OrderConversationWindow;locale:Locale}){
 const input=useRef<FormInputHandle>(null),id=window.context.orderId,state=model.stateFor(id),t=conversationEscalateCopy[locale],review=state.review,authority=model.authorityIssue();
 if(state.phase==="idle"&&!model.canBegin(window))return null;
 if(authority)return <Notice kind="error" title={authority==="authentication"?t.authentication:t.denied}/>;
 const issue=state.issue?(state.issue==="not-found"?t.notFound:state.issue==="invalid-result"?t.invalidResult:t[state.issue]):undefined;
 const token=state.editToken,key=state.formKey,error=state.reasonIssue?t[state.reasonIssue]:undefined;
 const check=()=>{if(token&&!model.check(id,token))input.current?.focus();};
 return <Stack>{window.conversation?.supportTicketId&&!(["RESOLVED","CLOSED"].includes(window.conversation.supportStatus??""))&&<Notice title={t.active}/>}{model.isEditing(window)&&token&&key?<Surface><Notice title={t.title} body={t.local}/><DraftFormInput ref={input} draftSelection={{owner:model,key,field:"body",readValue:()=>{const row=model.stateFor(id);return row.started&&row.formKey===key?row.rawReason:null;}}} accessibilityLabel={t.body} accessibilityHint={error??t.local} multiline textAlignVertical="top" style={styles.input} value={state.rawReason} onChangeText={body=>model.setText(id,token,body)}/>{error&&<Notice kind="error" title={t.error} body={error}/>}{state.checked&&!error&&<Notice title={t.checked}/>}<Button label={t.check} onPress={check}/>{model.canPrepare(window)&&<Button label={t.preview} onPress={()=>{if(!model.prepare(window))input.current?.focus();}}/>}<Button label={t.pause} onPress={()=>model.pause(id,token)}/><Button label={t.discard} onPress={()=>model.discard(id,token)}/></Surface>:model.canBegin(window)?<Stack>{state.started&&<Notice title={t.paused} body={t.local}/>}<Button label={state.started?t.resume:t.start} onPress={()=>model.begin(window)}/></Stack>:null}
 {!["idle","editing","paused"].includes(state.phase)&&<Surface>{review&&<Stack><Text strong>{t.review}</Text><Text>{`${t.order}: ${review.orderNumber}`}</Text><Text>{`${t.wire}: ${review.reason}`}</Text><Text secondary>{t.audience}</Text></Stack>}{issue&&<Notice kind="error" title={issue}/>}
 {state.phase==="prepared"&&review&&<Stack>{!model.canConfirm(review)&&<Notice title={t.stale}/>}<Button label={t.edit} onPress={()=>model.edit(review)}/>{model.canConfirm(review)&&<Button label={t.confirm} onPress={()=>{void model.confirm(review);}}/>}</Stack>}
 {state.phase==="pending"&&<Notice title={t.pending}/>}{state.phase==="result"&&<Notice title={t.result} body={t.resultBody}/>}{state.received&&<Notice title={t.receipt} body={t.receiptBody}/>}{state.unresolved&&state.phase!=="result"&&<Notice title={t.unknown} body={t.unknownBody}/>}{state.phase==="rejected"&&!state.unresolved&&<Notice title={t.rejected}/>}{state.phase==="reading"&&<Notice title={t.reading}/>}{state.phase==="read-error"&&<Notice kind="error" title={t.readError}/>}{(state.phase==="review"||state.phase==="observed")&&<Notice title={t.observed} body={t.observation}/>}
 {model.canRead(id)&&<Button label={t.read} onPress={()=>{void model.readCurrent(id);}}/>}{model.canAcknowledge(id)&&<Button label={t.ack} onPress={()=>model.acknowledge(id)}/>}{model.canReplay(id)&&<Button label={t.replay} onPress={()=>{void model.replay(id);}}/>}{model.canFinish(window)&&<Button label={t.finish} onPress={()=>model.finish(window)}/>}
 </Surface>}</Stack>;
}
const styles=StyleSheet.create({input:{minHeight:theme.height*3}});
