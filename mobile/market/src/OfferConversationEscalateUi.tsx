import { copy } from "./i18n";
import { useRef } from "react";
import { StyleSheet } from "react-native";
import type { OfferConversationEscalate } from "./offer-conversation-escalate";
import type { OfferConversationWindow } from "./offer-conversation-read";
import type { Locale } from "./format-wire";
import { DraftFormInput } from "./DraftFormInput";
import { Button, Notice, Stack, Surface, Text, type FormInputHandle } from "./ui/controls";
import { theme } from "./ui/theme";
import { conversationEscalateCopy } from "./OrderConversationEscalateUi";
export const offerEscalateCopy={ru:{...conversationEscalateCopy.ru,product:"Товар",variant:"Вариант",supplier:"Поставщик"},kk:{...conversationEscalateCopy.kk,product:"Тауар",variant:"Нұсқа",supplier:"Жеткізуші"}} as const;
export function OfferConversationEscalateUi({model,window,locale}:{model:OfferConversationEscalate;window:OfferConversationWindow;locale:Locale}){
 const input=useRef<FormInputHandle>(null),id=window.context.offerId,state=model.stateFor(id),t=offerEscalateCopy[locale],review=state.review,authority=model.authorityIssue();
 if(state.phase==="idle"&&!model.canBegin(window))return null;
 if(authority)return <Notice kind="error" title={authority==="authentication"?t.authentication:t.denied}/>;
 const issue=state.issue?(state.issue==="not-found"?t.notFound:state.issue==="invalid-result"?t.invalidResult:t[state.issue]):undefined;
 const token=state.editToken,key=state.formKey,error=state.reasonIssue?t[state.reasonIssue]:undefined;
 const check=()=>{if(token&&!model.check(id,token))input.current?.focus();};
 return <Stack>{window.conversation?.supportTicketId&&!(["RESOLVED","CLOSED"].includes(window.conversation.supportStatus??""))&&<Notice title={t.active}/>}{model.isEditing(window)&&token&&key?<Surface><Notice title={t.title} body={t.local}/><DraftFormInput ref={input} draftSelection={{owner:model,key,field:"body",readValue:()=>{const row=model.stateFor(id);return row.started&&row.formKey===key?row.rawReason:null;}}} accessibilityLabel={t.body} accessibilityHint={error??t.local} multiline textAlignVertical="top" style={styles.input} value={state.rawReason} onChangeText={body=>model.setText(id,token,body)}/>{error&&<Notice kind="error" title={t.error} body={error}/>}{state.checked&&!error&&<Notice title={t.checked}/>}<Button label={t.check} onPress={check}/>{model.canPrepare(window)&&<Button label={t.preview} onPress={()=>{if(!model.prepare(window))input.current?.focus();}}/>}<Button label={t.pause} onPress={()=>model.pause(id,token)}/><Button label={t.discard} onPress={()=>model.discard(id,token)}/></Surface>:model.canBegin(window)?<Stack>{state.started&&<Notice title={t.paused} body={t.local}/>}<Button label={state.started?t.resume:t.start} onPress={()=>model.begin(window)}/></Stack>:null}
 {!["idle","editing","paused"].includes(state.phase)&&<Surface>{review&&<Stack><Text strong>{t.review}</Text><Text>{`${t.product}: ${review.productName.trim()?review.productName:copy[locale].detailsUnknown}`}</Text><Text>{`${t.variant}: ${review.variantLabel.trim()?review.variantLabel:copy[locale].detailsUnknown}`}</Text><Text>{`${t.supplier}: ${review.supplierName.trim()?review.supplierName:copy[locale].partyUnknown}`}</Text><Text>{`${t.wire}: ${review.reason}`}</Text><Text secondary>{t.audience}</Text></Stack>}{issue&&<Notice kind="error" title={issue}/>}
 {state.phase==="prepared"&&review&&<Stack>{!model.canConfirm(review)&&<Notice title={t.stale}/>}<Button label={t.edit} onPress={()=>model.edit(review)}/>{model.canConfirm(review)&&<Button label={t.confirm} onPress={()=>{void model.confirm(review);}}/>}</Stack>}
 {state.phase==="pending"&&<Notice title={t.pending}/>}{state.phase==="result"&&<Notice title={t.result} body={t.resultBody}/>}{state.received&&<Notice title={t.receipt} body={t.receiptBody}/>}{state.unresolved&&state.phase!=="result"&&<Notice title={t.unknown} body={t.unknownBody}/>}{state.phase==="rejected"&&!state.unresolved&&<Notice title={t.rejected}/>}{state.phase==="reading"&&<Notice title={t.reading}/>}{state.phase==="read-error"&&<Notice kind="error" title={t.readError}/>}{(state.phase==="review"||state.phase==="observed")&&<Notice title={t.observed} body={t.observation}/>}
 {model.canRead(id)&&<Button label={t.read} onPress={()=>{void model.readCurrent(id);}}/>}{model.canAcknowledge(id)&&<Button label={t.ack} onPress={()=>model.acknowledge(id)}/>}{model.canReplay(id)&&<Button label={t.replay} onPress={()=>{void model.replay(id);}}/>}{model.canFinish(window)&&<Button label={t.finish} onPress={()=>model.finish(window)}/>}
 </Surface>}</Stack>;
}
const styles=StyleSheet.create({input:{minHeight:theme.height*3}});
