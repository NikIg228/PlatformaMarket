ALTER TABLE "OrderTransferClaim" DROP CONSTRAINT "OrderTransferClaim_status_check";
ALTER TABLE "OrderTransferClaim" ADD CONSTRAINT "OrderTransferClaim_status_check"
  CHECK ("status" IN ('PENDING', 'NEEDS_INFORMATION', 'NOT_RECEIVED', 'DISPUTED', 'CONFIRMED'));

ALTER TABLE "OrderPaymentReduction" ADD CONSTRAINT "OrderPaymentReduction_status_check"
  CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED'));
