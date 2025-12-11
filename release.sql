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

CREATE TABLE `master_tables_event` (
  `id` int NOT NULL AUTO_INCREMENT,
  `master_table_id` int DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `default_seats` int DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `room_id` int DEFAULT NULL,
  `x` double DEFAULT NULL,
  `y` double DEFAULT NULL,
  `width` double DEFAULT NULL,
  `height` double DEFAULT NULL,
  `shape` varchar(45) DEFAULT NULL,
  `event_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  KEY `master_tables_event_ibfk_1` (`event_id`),
  CONSTRAINT `master_tables_event_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`)
);


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

TRUNCATE TABLE master_tables;

INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 3/4',4,'ACTIVE',2,200,1000,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 2',4,'ACTIVE',2,45,850,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 3',4,'ACTIVE',2,45,1000,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 4',4,'ACTIVE',2,355,1000,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 5',6,'ACTIVE',2,310,815,150,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 6',6,'ACTIVE',2,310,655,150,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 7',6,'ACTIVE',2,310,495,150,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 8',6,'ACTIVE',2,310,340,150,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 9',6,'ACTIVE',2,310,190,150,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 10',6,'ACTIVE',2,45,190,150,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 11',6,'ACTIVE',2,45,340,150,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Palco Dx',4,'ACTIVE',2,360,25,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Palco Centro',4,'ACTIVE',2,205,25,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Palco Sx',4,'ACTIVE',2,50,25,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Bagni',8,'ACTIVE',1,25,30,200,200,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Fronte Spine',4,'ACTIVE',1,290,305,80,80,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Noire',8,'ACTIVE',1,20,500,100,100,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Bara',8,'ACTIVE',1,255,760,100,200,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Cor 1',4,'ACTIVE',1,225,490,150,80,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Cor 2',4,'ACTIVE',1,225,620,150,80,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Cor 3',2,'ACTIVE',1,30,675,80,80,'rect');
INSERT INTO master_tables (name, default_seats, status, room_id, x, y, width, height, shape) VALUES ('Tav. 1',8,'ACTIVE',2,45,620,100,200,'rect');


SET SQL_SAFE_UPDATES = 1;