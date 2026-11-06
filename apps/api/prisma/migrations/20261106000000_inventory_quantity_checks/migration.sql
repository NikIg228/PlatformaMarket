BEGIN;

ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_quantities_nonnegative_check" CHECK (
    "quantityOnHand" >= 0 AND "quantityOnHand" < 'Infinity'::numeric AND
    "quantityReserved" >= 0 AND "quantityReserved" < 'Infinity'::numeric AND
    "safetyStock" >= 0 AND "safetyStock" < 'Infinity'::numeric AND
    "quantityAvailable" >= 0 AND "quantityAvailable" < 'Infinity'::numeric
  ) NOT VALID,
  ADD CONSTRAINT "InventoryBalance_quantities_capacity_check" CHECK (
    "quantityAvailable" + "quantityReserved" + "safetyStock" <= "quantityOnHand"
  ) NOT VALID;

ALTER TABLE "InventoryLot"
  ADD CONSTRAINT "InventoryLot_quantities_nonnegative_check" CHECK (
    "quantityOnHand" >= 0 AND "quantityOnHand" < 'Infinity'::numeric AND
    "quantityReserved" >= 0 AND "quantityReserved" < 'Infinity'::numeric AND
    "quantityAvailable" >= 0 AND "quantityAvailable" < 'Infinity'::numeric
  ) NOT VALID,
  ADD CONSTRAINT "InventoryLot_quantities_capacity_check" CHECK (
    "quantityAvailable" + "quantityReserved" <= "quantityOnHand"
  ) NOT VALID;

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_quantity_positive_check" CHECK (
    quantity > 0 AND quantity < 'Infinity'::numeric
  ) NOT VALID;

ALTER TABLE "InventoryBalance" VALIDATE CONSTRAINT "InventoryBalance_quantities_nonnegative_check";
ALTER TABLE "InventoryBalance" VALIDATE CONSTRAINT "InventoryBalance_quantities_capacity_check";
ALTER TABLE "InventoryLot" VALIDATE CONSTRAINT "InventoryLot_quantities_nonnegative_check";
ALTER TABLE "InventoryLot" VALIDATE CONSTRAINT "InventoryLot_quantities_capacity_check";
ALTER TABLE "InventoryReservation" VALIDATE CONSTRAINT "InventoryReservation_quantity_positive_check";

COMMIT;
