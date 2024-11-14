USE railway;
CREATE TABLE `menu` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `creation_date` datetime,
  `status` varchar(255)
);

ALTER TABLE `events` 
ADD COLUMN `menu_id` INT NULL AFTER `status`;

ALTER TABLE `master_items` 
ADD COLUMN `menu_id` INT NULL AFTER `status`;

ALTER TABLE `master_items` ADD FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`);
ALTER TABLE `events` ADD FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`);

INSERT INTO `menu` (name, creation_date, status) VALUES ('Principale', NOW(), 'ACTIVE');

SET SQL_SAFE_UPDATES = 0;
UPDATE `master_items` SET menu_id = 1;
UPDATE `events` SET menu_id = 1;
SET SQL_SAFE_UPDATES = 1;