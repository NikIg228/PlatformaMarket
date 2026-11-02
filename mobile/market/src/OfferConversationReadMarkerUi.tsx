import { useSyncExternalStore } from "react";
import type { OfferConversationReadMarker } from "./offer-conversation-read-marker";
import type { OfferConversationWindow } from "./offer-conversation-read";
import { formatTimestamp, type Locale } from "./format-wire";
import { copy } from "./i18n";
import { readMarkerCopy } from "./OrderConversationReadMarkerUi";
import { Button, Notice, Stack, Surface, Text } from "./ui/controls";
export const offerReadMarkerCopy={ru:{...readMarkerCopy.ru,product:"Товар",variant:"Вариант",supplier:"Поставщик"},kk:{...readMarkerCopy.kk,product:"Тауар",variant:"Нұсқа",supplier:"Жеткізуші"}} as const;
export function OfferConversationReadMarkerUi({model,window,locale}:{model:OfferConversationReadMarker;window:OfferConversationWindow;locale:Locale}){
 useSyncExternalStore(model.subscribe,model.getSnapshot,model.getSnapshot);
 const id=window.conversation?.id,t=offerReadMarkerCopy[locale],state=id?model.stateFor(id):null,review=state?.review,authority=model.authorityIssue();
 const issue=state?.issue?(state.issue==="not-found"?t.notFound:state.issue==="invalid-result"?t.invalidResult:t[state.issue]):undefined;
 if(!id||!state)return null;
 if(authority)return <Notice kind="error" title={authority==="authentication"?t.authentication:t.denied}/>;
 if(!model.isAvailable())return null;
 return <Stack>{model.canPrepare(window)&&<Button label={t.start} onPress={()=>model.prepare(window)}/>}{state.phase!=="idle"&&<Surface>
 {review&&<Stack><Text strong>{t.review}</Text><Text>{`${t.product}: ${review.productName.trim()?review.productName:copy[locale].detailsUnknown}`}</Text><Text>{`${t.variant}: ${review.variantLabel.trim()?review.variantLabel:copy[locale].detailsUnknown}`}</Text><Text>{`${t.supplier}: ${review.supplierName.trim()?review.supplierName:copy[locale].partyUnknown}`}</Text><Text>{`${t.count}: ${review.messageCount}`}</Text><Text>{`${t.last}: ${formatTimestamp(review.lastMessageAt,locale)??copy[locale].dateUnknown}`}</Text><Text secondary>{t.body}</Text></Stack>}
 {issue&&<Notice kind="error" title={issue}/>}
 {state.phase==="prepared"&&review&&<Stack>{!model.canConfirm(review)&&<Notice title={t.stale}/>}<Button label={t.cancel} onPress={()=>model.cancel(review)}/>{model.canConfirm(review)&&<Button label={t.confirm} onPress={()=>{void model.confirm(review);}}/>}</Stack>}
 {state.phase==="pending"&&<Notice title={t.pending}/>}
 {state.confirmedThrough!==undefined&&<Notice title={t.receipt} body={t.receiptBody}/>}
 {state.unresolved&&<Notice title={t.unknown} body={t.unknownBody}/>}
 {state.phase==="rejected"&&!state.unresolved&&<Notice title={t.rejected}/>}
 {state.phase==="reading"&&<Notice title={t.reading}/>}{state.phase==="read-error"&&<Notice kind="error" title={t.readError}/>}
 {(state.phase==="review"||state.phase==="observed")&&<Notice title={t.observed} body={t.observation}/>}
 {model.canRead(id)&&<Button label={t.read} onPress={()=>{void model.readCurrent(id);}}/>}{model.canAcknowledge(id)&&<Button label={t.ack} onPress={()=>model.acknowledge(id)}/>}{model.canRepeat(id)&&<Button label={t.repeat} onPress={()=>{void model.repeat(id);}}/>}
 </Surface>}</Stack>;
}
