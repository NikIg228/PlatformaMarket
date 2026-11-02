import type { OrderConversationWindow } from "./order-conversation-read";
import type { Locale } from "./format-wire";
import { Button } from "./ui/controls";
export const conversationSupportCopy={ru:{open:"Читать связанное обращение",invalid:"Связь обращения с диалогом не подтверждена",invalidBody:"Перечитайте данные или вернитесь в переписку по заказу."},kk:{open:"Байланысты өтінішті оқу",invalid:"Өтініштің диалогпен байланысы расталмады",invalidBody:"Деректерді қайта оқыңыз немесе тапсырыс хат алмасуына оралыңыз."}} as const;
export function ConversationSupportLauncher({window,enabled,locale,onOpen}:{window:OrderConversationWindow;enabled:boolean;locale:Locale;onOpen:(window:OrderConversationWindow)=>void}){return enabled&&window.conversation?.supportTicketId?<Button label={conversationSupportCopy[locale].open} onPress={()=>onOpen(window)}/>:null;}
