ALTER TABLE "Shipment" ADD COLUMN "resupplyDiscrepancyId" UUID,
  ADD COLUMN "resupplySourceShipmentId" UUID;
ALTER TABLE "ShipmentItem" ADD COLUMN "resupplyQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "resupplyReservationId" UUID;

CREATE UNIQUE INDEX "Shipment_resupplyDiscrepancyId_key" ON "Shipment"("resupplyDiscrepancyId");
CREATE UNIQUE INDEX "Shipment_resupplySourceShipmentId_key" ON "Shipment"("resupplySourceShipmentId");
CREATE UNIQUE INDEX "ShipmentItem_resupplyReservationId_key" ON "ShipmentItem"("resupplyReservationId");
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_resupplyDiscrepancyId_fkey"
  FOREIGN KEY ("resupplyDiscrepancyId") REFERENCES "OrderDiscrepancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_resupplySourceShipmentId_fkey"
  FOREIGN KEY ("resupplySourceShipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_resupplyReservationId_fkey"
  FOREIGN KEY ("resupplyReservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_resupply_links_check"
  CHECK (("resupplyDiscrepancyId" IS NULL AND "resupplySourceShipmentId" IS NULL) OR
    ("resupplyDiscrepancyId" IS NOT NULL AND "resupplySourceShipmentId" IS NOT NULL AND "resupplySourceShipmentId" <> "id"));
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_resupply_quantity_check"
  CHECK ("resupplyQuantity" >= 0 AND "resupplyQuantity" <= "quantity" AND "deliveredQuantity" <= "quantity" - "resupplyQuantity");
