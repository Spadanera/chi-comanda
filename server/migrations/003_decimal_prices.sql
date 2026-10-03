-- Prices as DECIMAL(10,2) instead of DOUBLE: sums and discounts without rounding errors.
-- Existing values are rounded to the cent. Needs v1.19.3 or later (`decimalNumbers: true`), already in production.
ALTER TABLE `master_items` MODIFY `price` DECIMAL(10,2) NULL;
ALTER TABLE `items` MODIFY `price` DECIMAL(10,2) NULL;
ALTER TABLE `items_history` MODIFY `price` DECIMAL(10,2) NULL;
ALTER TABLE `events` MODIFY `minimumConsumptionPrice` DECIMAL(10,2) NULL;
