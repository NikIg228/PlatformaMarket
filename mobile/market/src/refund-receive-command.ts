import type { NativeBuyerWorkflowCommands } from "./native-buyer-workflow-commands";
import { createReturnSendCommands } from "./return-send-command";
import { createBuyerWorkflowKeys, type BuyerWorkflowKeys, type BuyerWorkflowCommandFixture } from "./order-workflow-command-fixture";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
/** Existing receiver-side declaration; no amount calculation, provider or proof upload. */
export function createRefundReceiveCommands(scope:ReadScope,fixture:BuyerWorkflowCommandFixture|undefined,currentWorkflow:(id:string)=>OrderWorkflowResponse|null,reloadWorkflow:(id:string)=>Promise<OrderWorkflowResponse|undefined>,isWorkflowActive:(id:string)=>boolean,otherOrderLocked:(id:string)=>boolean=()=>false,keyPool:BuyerWorkflowKeys|undefined=undefined,native?:NativeBuyerWorkflowCommands){
 return createReturnSendCommands(scope,fixture,currentWorkflow,reloadWorkflow,isWorkflowActive,otherOrderLocked,keyPool,"RECEIVE_MANUAL_REFUND",native);
}
export type RefundReceiveCommands=ReturnType<typeof createRefundReceiveCommands>;
