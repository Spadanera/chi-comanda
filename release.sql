USE railway;

SET SQL_SAFE_UPDATES = 0;

ALTER TABLE `railway`.`events` 
ADD COLUMN `minimumConsumptionPrice` DOUBLE NULL AFTER `menu_id`;

ALTER TABLE `railway`.`items` 
ADD COLUMN `menu_id` INT NULL AFTER `destination_id`;

ALTER TABLE `railway`.`items` 
ADD COLUMN `setMinimum` TINYINT(1) NULL AFTER `menu_id`;

SET SQL_SAFE_UPDATES = 1;