import { receiptWorkflow, receiptScope, receiptId } from "./receipt-draft";
export const goodsReturnScope = receiptScope, goodsReturnId = receiptId;
export function goodsReturnWorkflow(two = false) { const value = receiptWorkflow(two); for (const item of value.order.items) { item.quantity = "2.5"; item.acceptedQuantity = "2"; } return value; }
