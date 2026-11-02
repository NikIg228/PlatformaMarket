import { Fragment,useState,type ReactNode } from "react";
import { discrepancyStatementSchema } from "../../../packages/schemas/src/order-discrepancy";
import { compareReceiptCounts } from "./shipment-receipt-draft";
import type { Locale } from "./format-wire";
import { Button,Notice,Stack,Text } from "./ui/controls";
export const discrepancyLinePageCopy={ru:{count:"Строк в заявлении",page:"Страница строк заявления",previous:"Предыдущая страница строк заявления",next:"Следующая страница строк заявления",all:"Проверка и отправка охватывают все строки заявления",invalid:"Строка с ошибкой количества"},kk:{count:"Өтініштегі жолдар",page:"Өтініш жолдары беті",previous:"Өтініш жолдарының алдыңғы беті",next:"Өтініш жолдарының келесі беті",all:"Тексеру мен жіберу өтініштің барлық жолын қамтиды",invalid:"Саны қате жол"}} as const;
export const discrepancyLinesPerPage=20;
export function firstInvalidDiscrepancyQuantity(lines:readonly Readonly<{actual:string;damaged:string}>[]):number|null{
 const quantity=discrepancyStatementSchema.shape.lines.element.shape.actualQuantity;
 const index=lines.findIndex(line=>{const actual=line.actual.trim().replace(",","."),damaged=line.damaged.trim().replace(",",".");return !quantity.safeParse(actual).success||!quantity.safeParse(damaged).success||compareReceiptCounts(damaged,actual)===1;});return index<0?null:index;
}
/** Only display position lives here; complete raw reports and selection offsets remain model-owned. */
export function useDiscrepancyLinePage(target:object|null){const [position,setPosition]=useState<{target:object|null;page:number}>({target:null,page:0});return{page:position.target===target?position.page:0,setPage:(page:number)=>setPosition({target,page})};}
export function NativeDiscrepancyLinePage<T extends {shipmentItemId:string}>({lines,page,setPage,locale,renderLine,customCopy}:{customCopy?:Readonly<{count:string;page:string;previous:string;next:string;all:string}>;lines:readonly T[];page:number;setPage:(page:number)=>void;locale:Locale;renderLine:(line:T,index:number)=>ReactNode}){
 const c=customCopy??discrepancyLinePageCopy[locale],pages=Math.max(1,Math.ceil(lines.length/discrepancyLinesPerPage)),selected=Number.isInteger(page)?Math.max(0,Math.min(pages-1,page)):0,offset=selected*discrepancyLinesPerPage;
 return <Stack><Text>{c.count}: {lines.length}</Text>{lines.length>discrepancyLinesPerPage&&<Notice title={c.all}/>}{lines.slice(offset,offset+discrepancyLinesPerPage).map((line,index)=><Fragment key={line.shipmentItemId}>{renderLine(line,offset+index)}</Fragment>)}{pages>1&&<Stack><Text>{c.page}: {selected+1} / {pages}</Text><Stack row><Button label={c.previous} disabled={selected===0} onPress={()=>setPage(selected-1)}/><Button label={c.next} disabled={selected+1>=pages} onPress={()=>setPage(selected+1)}/></Stack></Stack>}</Stack>;
}
