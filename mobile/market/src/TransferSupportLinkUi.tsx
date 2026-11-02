import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { DisputeClaim } from "./payment-dispute-source";
import type { TransferSupportLinks, TransferSupportSelection } from "./transfer-support-link";
import type { Locale } from "./format-wire";
import { Button } from "./ui/controls";
export const transferSupportCopy={ru:{open:"Читать связанное обращение",claim:"Заявленный перевод",invalid:"Связь обращения с заказом не подтверждена",invalidBody:"Ответ поддержки не подтверждает ссылку на исходный заказ. Содержимое через этот переход не показано; обновите чтение или вернитесь к заказу."},kk:{open:"Байланыстырылған өтінішті оқу",claim:"Мәлімделген аударым",invalid:"Өтініштің тапсырыспен байланысы расталмаған",invalidBody:"Қолдау жауабы бастапқы тапсырыс сілтемесін растамайды. Бұл өту арқылы мазмұн көрсетілмейді; оқуды жаңартыңыз не тапсырысқа оралыңыз."}} as const;
export function TransferSupportLauncher({model,workflow,claim,index,locale,onOpen}:{model:TransferSupportLinks;workflow:OrderWorkflowResponse;claim:DisputeClaim;index:number;locale:Locale;onOpen:(target:TransferSupportSelection)=>void}){const target=model.select(workflow,claim),t=transferSupportCopy[locale];return target?<Button label={t.open} accessibilityLabel={`${t.open}: ${t.claim} ${index+1}`} onPress={()=>onOpen(target)}/>:null;}
