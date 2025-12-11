USE railway;

SET SQL_SAFE_UPDATES = 0;

CREATE TABLE `railway`.`rooms` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NULL,
  `width` DOUBLE NULL,
  `height` DOUBLE NULL,
  `status` VARCHAR(255) NULL
);

ALTER TABLE `railway`.`master_tables` 
ADD COLUMN `room_id` integer NULL AFTER `status`,
ADD COLUMN `x` DOUBLE NULL AFTER `room_id`,
ADD COLUMN `y` DOUBLE NULL AFTER `x`,
ADD COLUMN `width` DOUBLE NULL AFTER `y`,
ADD COLUMN `height` DOUBLE NULL AFTER `width`,
ADD COLUMN `shape` VARCHAR(45) NULL AFTER `height`;

ALTER TABLE `master_tables` ADD FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`);

DROP TABLE table_master_table;

CREATE TABLE `table_master_table` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_id` int DEFAULT NULL,
  `master_table_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `table_id` (`table_id`),
  CONSTRAINT `table_master_table_ibfk_1` FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`),
  CONSTRAINT `table_master_table_ibfk_2` FOREIGN KEY (`id`) REFERENCES `master_tables_event` (`id`)
);


INSERT INTO `rooms` (name, width, height) VALUES ('Sala 1', 4, 15);
INSERT INTO `rooms` (name, width, height) VALUES ('Sala 2', 5, 12);

UPDATE `master_tables` SET room_id = 2, height = 100, width = 100, x = 50, y = 50, shape = 'rect';
UPDATE `master_tables` SET room_id = 1 WHERE name in ('Bagni Dx','Bagni Sx','Noire','Bara','Cor 1','Cor 2','Cor 3');


SET SQL_SAFE_UPDATES = 1;