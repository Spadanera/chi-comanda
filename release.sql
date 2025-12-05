USE railway;

SET SQL_SAFE_UPDATES = 0;

CREATE TABLE `railway`.`rooms` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NULL,
  `width` DOUBLE NULL,
  `height` DOUBLE NULL
);

ALTER TABLE `railway`.`master_tables` 
ADD COLUMN `room_id` integer NULL AFTER `status`,
ADD COLUMN `x` DOUBLE NULL AFTER `room_id`,
ADD COLUMN `y` DOUBLE NULL AFTER `x`,
ADD COLUMN `width` DOUBLE NULL AFTER `y`,
ADD COLUMN `height` DOUBLE NULL AFTER `width`,
ADD COLUMN `shape` VARCHAR(45) NULL AFTER `height`;

INSERT INTO `rooms` (name, width, height) VALUES ('Sala 1', 4, 15);
INSERT INTO `rooms` (name, width, height) VALUES ('Sala 2', 5, 12);

UPDATE `master_tables` SET room_id = 2, height = 100, width = 100, x = 50, y = 50;
UPDATE `master_tables` SET room_id = 1 WHERE name in ('Bagni Dx','Bagni Sx','Noire','Bara','Cor 1','Cor 2','Cor 3');

ALTER TABLE `master_tables` ADD FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`);

SET SQL_SAFE_UPDATES = 1;