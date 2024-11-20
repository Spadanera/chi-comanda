USE railway;

SET SQL_SAFE_UPDATES = 0;

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

INSERT INTO `menu` (name, creation_date, status) VALUES ('Menu Principale', NOW(), 'ACTIVE');

UPDATE `master_items` SET menu_id = 1;
UPDATE `events` SET menu_id = 1;

CREATE TABLE `types` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `icon` varchar(255)
);

CREATE TABLE `sub_types` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `type_id` integer,
  `icon` varchar(255)
);

ALTER TABLE `sub_types` ADD FOREIGN KEY (`type_id`) REFERENCES `types` (`id`);

INSERT INTO `types` (name, icon) VALUES ('Bevenda', 'mdi-beer');
INSERT INTO `types` (name, icon) VALUES ('Cibo', 'mdi-hamburger');

INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Birra alla spina', 1, 'mdi-glass-mug-variant');
INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Birra in bottiglia', 1, 'mdi-bottle-wine');
INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Cocktail', 1, 'mdi-glass-cocktail');
INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Analcolico', 1, 'mdi-bottle-soda');
INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Extra', 1, 'mdi-glass-wine');
INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Special', 2, 'mdi-french-fries');
INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Piadina', 2, 'mdi-taco');
INSERT INTO `sub_types` (name, type_id, icon) VALUES ('Panino', 2, 'mdi-food-hot-dog');

ALTER TABLE `master_items` 
ADD COLUMN `sub_type_id` INT NULL AFTER `menu_id`;

UPDATE master_items SET sub_type = 'Birra alla spina' WHERE sub_type = 'Birra';

UPDATE master_items
INNER JOIN sub_types ON master_items.sub_type = sub_types.name
SET master_items.sub_type_id = sub_types.id;

ALTER TABLE `master_items` 
DROP COLUMN `sub_type`,
DROP COLUMN `type`;

ALTER TABLE `items` 
ADD COLUMN `icon` VARCHAR(255) NULL AFTER `sub_type`;

UPDATE items 
INNER JOIN master_items ON master_items.id = items.master_item_id
INNER JOIN sub_types ON master_items.sub_type_id = sub_types.id
SET items.icon = sub_types.icon;


SET SQL_SAFE_UPDATES = 1;