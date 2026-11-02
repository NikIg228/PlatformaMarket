import { StrictMode, type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { FormInputHandle } from "./ui/controls";
import { orderCommentRowFixtureSchema } from "./order-comment-row-fixture";
import type { EditOrderCommentInput, OrderCommentEditFixture } from "./order-comment-edit-command";
import { commentEditCopy } from "./OrderCommentEditCommandUi";
import { orderCommentCreateCopy } from "./OrderCommentCreateCommandUi";
import { orderCommentsCopy } from "./OrderCommentsRead";
import { commentEditScope as scope, commentEditId as id, commentEditAuthorization, commentEditRawRow, commentEditResult, commentEditError } from "./test-fixtures/order-comment-edit-command";
import { commentCreateResult } from "./test-fixtures/order-comment-create-command";
import { commentWorkflow, orderComments } from "./test-fixtures/order-comments";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { copy } from "./i18n";
const mockHandles=new Map<string,FormInputHandle>();
jest.mock("./ui/controls",()=>{const real=jest.requireActual<typeof import("./ui/controls")>("./ui/controls"),React=jest.requireActual<typeof import("react")>("react");return {...real,FormInput:React.forwardRef<FormInputHandle,ComponentProps<typeof real.FormInput>>((props,ref)=>React.createElement(real.FormInput,{...props,ref:node=>{if(node)mockHandles.set(props.accessibilityLabel,node);if(typeof ref==="function")ref(node);else if(ref)ref.current=node;}}))};});
afterEach(()=>{mockHandles.clear();jest.restoreAllMocks();});
const rawBody="  SYNTHETIC өзгертілген пікір\nНовая строка  ";
function setup(){
 const workflow=commentWorkflow(),original=commentEditRawRow();let truth=[original,...orderComments().map(row=>orderCommentRowFixtureSchema.parse({...row,authorUserId:id(19991)}))];
 const read=jest.fn(async(_scope:typeof scope,_id:string):Promise<unknown>=>truth);
 const commit=(requestScope:typeof scope,commentId:string,input:Readonly<EditOrderCommentInput>)=>{const row=truth.find(row=>row.id===commentId&&row.authorOrganizationId===requestScope.organizationId&&row.authorUserId===requestScope.userId);if(!row)throw commentEditError(404);if(row.version!==input.version)throw commentEditError(409);const result=commentEditResult(row,input);truth=truth.map(row=>row.id===commentId?result:row);return result;};
 const send=jest.fn(async(requestScope:typeof scope,commentId:string,input:Readonly<EditOrderCommentInput>):Promise<unknown>=>commit(requestScope,commentId,input));
 const fixture:OrderCommentEditFixture={authorization:commentEditAuthorization(),updateOrderComment:send};
 const key=jest.fn(()=>"SYNTHETIC-new-comment-key"),create=jest.fn(async(_scope:typeof scope,orderId:string,input:Parameters<typeof commentCreateResult>[1]):Promise<unknown>=>commentCreateResult(orderId,input));
 const client:MobileReadClient={searchCatalog:async()=>listDraftPayload("catalog-empty"),compareOffers:async()=>listDraftPayload("comparison-exact-offer"),workspaceOrders:async()=>listDraftPayload("workspace-orders-page"),getOrderWorkflow:async()=>workflow,workspaceCarts:async()=>({current:null,items:[],nextCursor:null}),orderCommentsFixture:read,orderCommentEditCommandFixture:fixture,orderCommentCreateCommandFixture:{authorization:commentEditAuthorization(),nextOrderCommentIdempotencyKey:key,createOrderComment:create}};
 return {workflow,original,truth:()=>truth,setRows:(rows:typeof truth)=>{truth=rows;},read,commit,send,fixture,key,create,client};
}
const session=(client:MobileReadClient)=>({client,scope,organizationName:"SYNTHETIC"});
async function selectThread(locale:"ru"|"kk"="ru"){
 await fireEvent.press(screen.getByRole("tab",{name:copy[locale].orders}));
 await screen.findByRole("button",{name:`${copy[locale].open}: SYNTHETIC-READ-001`});
 await fireEvent.press(screen.getByRole("button",{name:`${copy[locale].open}: SYNTHETIC-READ-001`}));
 await screen.findByRole("button",{name:orderCommentsCopy[locale].open});
 await fireEvent.press(screen.getByRole("button",{name:orderCommentsCopy[locale].open}));
 await screen.findByText(orderCommentsCopy[locale].editBoundary);
}
async function enter(s:ReturnType<typeof setup>,locale:"ru"|"kk"="ru"){const view=await render(<StrictMode><App session={session(s.client)} locale={locale}/></StrictMode>);await selectThread(locale);return view;}
const launchName=(locale:"ru"|"kk"="ru",resume=false,index=1)=>`${resume?commentEditCopy[locale].resume:commentEditCopy[locale].start}: ${commentEditCopy[locale].comment} ${index}`;
async function start(locale:"ru"|"kk"="ru",resume=false){await fireEvent.press(screen.getByRole("button",{name:launchName(locale,resume)}));await screen.findByLabelText(commentEditCopy[locale].body);}
async function prepare(locale:"ru"|"kk"="ru"){const t=commentEditCopy[locale];await fireEvent.changeText(screen.getByLabelText(t.body),rawBody);await fireEvent.press(screen.getByRole("button",{name:t.preview}));await screen.findByText(t.reviewTitle);}
async function confirm(locale:"ru"|"kk"="ru"){await fireEvent.press(screen.getByRole("button",{name:commentEditCopy[locale].confirm}));}
async function readAck(locale:"ru"|"kk"="ru"){const t=commentEditCopy[locale];await fireEvent.press(screen.getByRole("button",{name:t.read}));await screen.findByText(t.review);await fireEvent.press(screen.getByRole("button",{name:t.acknowledge}));}
it.each(["ru","kk"] as const)("limits controls to actual own author, explicitly reviews old/new text and sends body/version only in%s",async locale=>{
 const s=setup(),t=commentEditCopy[locale];await enter(s,locale);
 expect(screen.getByRole("button",{name:launchName(locale)})).toBeOnTheScreen();expect(screen.queryByRole("button",{name:launchName(locale,false,2)})).toBeNull();expect(screen.queryByRole("button",{name:launchName(locale,false,3)})).toBeNull();
 expect(screen.getByText(t.ownOnly)).toBeOnTheScreen();await start(locale);
 expect(screen.getByLabelText(t.body)).toHaveDisplayValue(s.original.body);
 expect(screen.getByText(`${t.previous}: ${s.original.body}`)).toBeOnTheScreen();await prepare(locale);
 expect(screen.getByText(`${t.version}: 2`)).toBeOnTheScreen();expect(screen.getByText(`${t.wire}: ${rawBody.trim()}`)).toBeOnTheScreen();expect(s.send).not.toHaveBeenCalled();
 await confirm(locale);await screen.findByText(t.received);
 expect(s.send.mock.calls[0]).toEqual([scope,s.original.id,{body:rawBody.trim(),version:2}]);expect(s.key).not.toHaveBeenCalled();expect(s.read).toHaveBeenCalledTimes(1);
 expect(screen.getByText(s.original.body)).toBeOnTheScreen();expect(screen.queryByText(rawBody.trim())).toBeNull();
 await readAck(locale);expect(screen.getByText(rawBody.trim())).toBeOnTheScreen();expect(s.send).toHaveBeenCalledTimes(1);
 await start(locale);expect(screen.getByLabelText(t.body)).toHaveDisplayValue(rawBody.trim());
});
it("preserves raw body/caret through validation, preview/edit and pause; discard alone seeds a fresh editor from current stored text",async()=>{
 const s=setup(),t=commentEditCopy.ru;await enter(s);await start();const focus=jest.spyOn(mockHandles.get(t.body)!,"focus");
 await fireEvent.changeText(screen.getByLabelText(t.body),"  \n ");await fireEvent(screen.getByLabelText(t.body),"submitEditing");await screen.findByRole("alert",{name:`${t.body}: ${t.required}`});expect(focus).toHaveBeenCalled();
 const long="x".repeat(10001);await fireEvent.changeText(screen.getByLabelText(t.body),long);await fireEvent.press(screen.getByRole("button",{name:t.preview}));await screen.findByRole("alert",{name:`${t.body}: ${t.tooLong}`});expect(screen.getByLabelText(t.body)).toHaveDisplayValue(long);
 await fireEvent.changeText(screen.getByLabelText(t.body),rawBody);await fireEvent(screen.getByLabelText(t.body),"selectionChange",{nativeEvent:{selection:{start:2,end:7}}});
 await fireEvent.press(screen.getByRole("button",{name:t.preview}));await screen.findByText(t.reviewTitle);await fireEvent.press(screen.getByRole("button",{name:t.edit}));await screen.findByLabelText(t.body);expect(screen.getByLabelText(t.body)).toHaveProp("selection",{start:2,end:7});
 await fireEvent.press(screen.getByRole("button",{name:t.pause}));await start("ru",true);expect(screen.getByLabelText(t.body)).toHaveDisplayValue(rawBody);expect(screen.getByLabelText(t.body)).toHaveProp("selection",{start:2,end:7});
 await fireEvent.press(screen.getByRole("button",{name:t.discard}));await start();expect(screen.getByLabelText(t.body)).toHaveDisplayValue(s.original.body);expect(s.send).not.toHaveBeenCalled();
});
it("preserves local raw body/caret across language change and selecting a fresh thread after another tab",async()=>{
 const s=setup(),view=await enter(s),t=commentEditCopy.ru;await start();await fireEvent.changeText(screen.getByLabelText(t.body),rawBody);await fireEvent(screen.getByLabelText(t.body),"selectionChange",{nativeEvent:{selection:{start:2,end:7}}});
 await view.rerender(<StrictMode><App session={session(s.client)} locale="kk"/></StrictMode>);const k=commentEditCopy.kk;await screen.findByLabelText(k.body);expect(screen.getByLabelText(k.body)).toHaveProp("selection",{start:2,end:7});
 await fireEvent.press(screen.getByRole("tab",{name:copy.kk.cart}));await screen.findByText(copy.kk.noCurrentCart);await selectThread("kk");await start("kk",true);expect(screen.getByLabelText(k.body)).toHaveDisplayValue(rawBody);expect(screen.getByLabelText(k.body)).toHaveProp("selection",{start:2,end:7});expect(s.send).not.toHaveBeenCalled();
});
it.each(["ru","kk"] as const)("retains a lost committed edit through matching GET and an independently confirmed next-version edit in%s",async locale=>{
 const s=setup(),t=commentEditCopy[locale];s.send.mockImplementationOnce(async(requestScope,commentId,input)=>{s.commit(requestScope,commentId,input);throw commentEditError(500);});await enter(s,locale);await start(locale);await prepare(locale);await confirm(locale);await screen.findByText(t.unknown);
 expect(screen.queryByRole("button",{name:/Повторить|Қайталау/})).toBeNull();await readAck(locale);expect(screen.getByText(t.unknown)).toBeOnTheScreen();expect(s.send).toHaveBeenCalledTimes(1);
 await start(locale,true);expect(screen.getByLabelText(t.body)).toHaveDisplayValue(rawBody);await fireEvent.press(screen.getByRole("button",{name:t.preview}));await screen.findByText(`${t.version}: 3`);await confirm(locale);await screen.findByText(t.received);
 expect(s.send.mock.calls.map(call=>call[2])).toEqual([{body:rawBody.trim(),version:2},{body:rawBody.trim(),version:3}]);expect(screen.getByText(`${t.history}: 1`)).toBeOnTheScreen();expect(screen.getByText(t.historyBody)).toBeOnTheScreen();expect(s.key).not.toHaveBeenCalled();
});
it("retains conflict raw body/caret, accepts a fresh version explicitly and never substitutes it into the old review",async()=>{
 const s=setup(),t=commentEditCopy.ru;s.send.mockRejectedValueOnce(commentEditError(409));await enter(s);await start();await fireEvent.changeText(screen.getByLabelText(t.body),rawBody);await fireEvent(screen.getByLabelText(t.body),"selectionChange",{nativeEvent:{selection:{start:2,end:7}}});await fireEvent.press(screen.getByRole("button",{name:t.preview}));await confirm();await screen.findByText(t.rejected);
 s.setRows(s.truth().map(row=>row.id===s.original.id?{...row,version:4,body:"SYNTHETIC other-device current text"}:row));await readAck();await start("ru",true);expect(screen.getByLabelText(t.body)).toHaveDisplayValue(rawBody);expect(screen.getByLabelText(t.body)).toHaveProp("selection",{start:2,end:7});expect(screen.getByText(`${t.version}: 4`)).toBeOnTheScreen();expect(s.send).toHaveBeenCalledTimes(1);
 await fireEvent.press(screen.getByRole("button",{name:t.preview}));await confirm();await screen.findByText(t.received);expect(s.send.mock.calls[1]![2].version).toBe(4);
});
it("invalidates unsent review after a fresh read and requires actual current own row re-selection before a new preview",async()=>{
 const s=setup(),t=commentEditCopy.ru;await enter(s);await start();await prepare();s.setRows(s.truth().map(row=>row.id===s.original.id?{...row,version:5}:row));await fireEvent.press(screen.getByRole("button",{name:copy.ru.refresh}));await screen.findByText(t.stale);expect(screen.queryByRole("button",{name:t.confirm})).toBeNull();
 await fireEvent.press(screen.getByRole("button",{name:t.edit}));await start("ru",true);expect(screen.getByLabelText(t.body)).toHaveDisplayValue(rawBody);expect(screen.getByText(`${t.version}: 5`)).toBeOnTheScreen();await fireEvent.press(screen.getByRole("button",{name:t.preview}));await confirm();await screen.findByText(t.received);expect(s.send.mock.calls[0]![2].version).toBe(5);
});
it("keeps pending update singular through independent same-order GET and accepts the separate bound response",async()=>{
 const s=setup(),t=commentEditCopy.ru;let finish!:(body:unknown)=>void;s.send.mockImplementationOnce(()=>new Promise(yes=>{finish=yes;}));await enter(s);await start();await prepare();await confirm();await screen.findByText(t.pending);expect(screen.queryByRole("button",{name:t.confirm})).toBeNull();await fireEvent.press(screen.getByRole("button",{name:copy.ru.refresh}));
 await act(async()=>{finish(commentEditResult(s.original,s.send.mock.calls[0]![2]));});await screen.findByText(t.received);expect(s.send).toHaveBeenCalledTimes(1);
});
it("shows a later response body/version separately without claiming the original edit text replaced the thread",async()=>{
 const s=setup(),t=commentEditCopy.ru;s.send.mockImplementationOnce(async(_scope,_id,input)=>({...commentEditResult(s.original,input,5),body:"SYNTHETIC later edit"}));await enter(s);await start();await prepare();await confirm();await screen.findByText(t.mismatch);expect(screen.getByText(`${t.returnedBody}: SYNTHETIC later edit`)).toBeOnTheScreen();expect(screen.getByText(`${t.returnedVersion}: 5`)).toBeOnTheScreen();expect(screen.getByText(s.original.body)).toBeOnTheScreen();expect(screen.getByText(`${t.wire}: ${rawBody.trim()}`)).toBeOnTheScreen();
});
it.each(["authorUserId","supplierOrderId"])("keeps a foreign%s response unknown without exposing private response text",async field=>{
 const s=setup(),t=commentEditCopy.ru;s.send.mockImplementationOnce(async(_scope,_id,input)=>({...commentEditResult(s.original,input),[field]:id(9999),body:"SYNTHETIC foreign updated text"}));await enter(s);await start();await prepare();await confirm();await screen.findByText(t.unknown);expect(screen.queryByText(/SYNTHETIC foreign updated text/)).toBeNull();
});
it("treats 404 as uncertain and shows absent source separately after GET without selecting another row",async()=>{
 const s=setup(),t=commentEditCopy.ru;s.send.mockRejectedValueOnce(commentEditError(404));await enter(s);await start();await prepare();await confirm();await screen.findByText(t.unknown);s.setRows(s.truth().filter(row=>row.id!==s.original.id));await fireEvent.press(screen.getByRole("button",{name:t.read}));await screen.findByText(t.missing);await fireEvent.press(screen.getByRole("button",{name:t.acknowledge}));expect(screen.queryByRole("button",{name:launchName("ru",true)})).toBeNull();expect(screen.getByText(t.unknown)).toBeOnTheScreen();expect(s.send).toHaveBeenCalledTimes(1);
});
it.each([401,403])("latches shared command denial after%i; plain GET restores neither editor nor creator",async status=>{
 const s=setup(),t=commentEditCopy.ru;s.send.mockRejectedValueOnce(commentEditError(status));await enter(s);await start();await prepare();await confirm();await screen.findByText(status===401?t.auth:t.denied);await fireEvent.press(screen.getByRole("button",{name:copy.ru.refresh}));await screen.findByText(status===401?t.auth:t.denied);expect(screen.queryByRole("button",{name:launchName()})).toBeNull();expect(screen.getByRole("button",{name:orderCommentCreateCopy.ru.start})).toBeDisabled();expect(s.send).toHaveBeenCalledTimes(1);
});
it("latches actual parent read denial after unknown edit and hides private draft through later Retry metadata",async()=>{
 const s=setup(),t=commentEditCopy.ru;s.send.mockRejectedValueOnce(new Error("SYNTHETIC lost"));await enter(s);await start();await prepare();await confirm();await screen.findByText(t.unknown);s.read.mockRejectedValueOnce(commentEditError(403));await fireEvent.press(screen.getByRole("button",{name:t.read}));await screen.findByText(t.denied);expect(screen.queryByText(`${t.raw}: ${rawBody}`)).toBeNull();await fireEvent.press(screen.getByRole("button",{name:copy.ru.retry}));await screen.findByText(t.denied);expect(screen.queryByRole("button",{name:launchName()})).toBeNull();expect(s.send).toHaveBeenCalledTimes(1);
});
it("drops previous-generation pending reply before private body decode",async()=>{
 const s=setup(),t=commentEditCopy.ru;let finish!:(body:unknown)=>void;s.send.mockImplementationOnce(()=>new Promise(yes=>{finish=yes;}));const view=await enter(s);await start();await prepare();await confirm();await view.rerender(<StrictMode><App session={{...session(s.client),scope:{...scope,generation:2}}}/></StrictMode>);const peek=jest.fn(()=>{throw new Error("must not decode previous-generation edit");});await act(async()=>{finish(Object.defineProperty({},"body",{get:peek}));});expect(peek).not.toHaveBeenCalled();expect(screen.queryByText(`${t.raw}: ${rawBody}`)).toBeNull();
});
it("retains default readonly party projection without inspecting optional private actor/key getters",async()=>{
 const s=setup();delete s.client.orderCommentEditCommandFixture;delete s.client.orderCommentCreateCommandFixture;const peek=jest.fn(()=>{throw new Error("default readonly GET must ignore edit provenance");}),row={...s.original};Object.defineProperty(row,"authorUserId",{get:peek});Object.defineProperty(row,"idempotencyKey",{get:peek});s.setRows([row]);await render(<App session={session(s.client)}/>);await fireEvent.press(screen.getByRole("tab",{name:copy.ru.orders}));await screen.findByRole("button",{name:`${copy.ru.open}: SYNTHETIC-READ-001`});await fireEvent.press(screen.getByRole("button",{name:`${copy.ru.open}: SYNTHETIC-READ-001`}));await screen.findByRole("button",{name:orderCommentsCopy.ru.open});await fireEvent.press(screen.getByRole("button",{name:orderCommentsCopy.ru.open}));await screen.findByText(orderCommentsCopy.ru.boundary);expect(peek).not.toHaveBeenCalled();expect(screen.queryByRole("button",{name:launchName()})).toBeNull();expect(s.send).not.toHaveBeenCalled();
});

it("hides both command drafts after actual creator denial and drops the pending editor reply before private body decode",async()=>{
 const s=setup(),t=commentEditCopy.ru,c=orderCommentCreateCopy.ru;let finish!:(body:unknown)=>void;s.send.mockImplementationOnce(()=>new Promise(yes=>{finish=yes;}));s.create.mockRejectedValueOnce(commentEditError(403));await enter(s);await start();await prepare();await confirm();await screen.findByText(t.pending);
 await fireEvent.press(screen.getByRole("button",{name:c.start}));await screen.findByLabelText(c.body);await fireEvent.changeText(screen.getByLabelText(c.body),"SYNTHETIC private create draft");await fireEvent.press(screen.getByRole("button",{name:c.preview}));await screen.findByText(c.reviewTitle);await fireEvent.press(screen.getByRole("button",{name:c.confirm}));await screen.findByText(c.denied);
 const peek=jest.fn(()=>"SYNTHETIC late updated private body"),reply=commentEditResult(s.original,s.send.mock.calls[0]![2]);Object.defineProperty(reply,"body",{get:peek});await act(async()=>{finish(reply);});await screen.findByText(t.denied);expect(peek).not.toHaveBeenCalled();expect(screen.queryByText(`${t.raw}: ${rawBody}`)).toBeNull();expect(screen.queryByText(`${c.raw}: SYNTHETIC private create draft`)).toBeNull();expect(screen.queryByText(t.received)).toBeNull();
});
