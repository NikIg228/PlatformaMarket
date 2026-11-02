import type { OfferConversationWindow } from "./offer-conversation-read";
import type { Locale } from "./format-wire";
import { conversationSupportCopy } from "./ConversationSupportLinkUi";
import { Button } from "./ui/controls";
export const offerSupportCopy={ru:{...conversationSupportCopy.ru,invalidBody:"Перечитайте данные или вернитесь в диалог по предложению."},kk:{...conversationSupportCopy.kk,invalidBody:"Деректерді қайта оқыңыз немесе ұсыныс диалогына оралыңыз."}} as const;
export function OfferConversationSupportLauncher({window,enabled,locale,onOpen}:{window:OfferConversationWindow;enabled:boolean;locale:Locale;onOpen:(window:OfferConversationWindow)=>void}){return enabled&&window.conversation?.supportTicketId?<Button label={offerSupportCopy[locale].open} onPress={()=>onOpen(window)}/>:null;}
