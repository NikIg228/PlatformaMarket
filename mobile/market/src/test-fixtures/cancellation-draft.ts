import { commentWorkflow, commentScope, commentId } from "./order-comments";
export const cancellationScope = commentScope, cancellationId = commentId;
export function cancellationWorkflow() { const value = commentWorkflow(); value.version = value.order.version = 3; value.status = value.order.status = "AWAITING_PAYMENT"; value.paymentStatus = value.order.paymentStatus = "UNPAID"; return value; }
