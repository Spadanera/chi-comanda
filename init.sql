CREATE TABLE `reset` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `email` varchar(255),
  `token` varchar(255),
  `creation_date` datetime
);

CREATE TABLE `users` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `username` varchar(255),
  `email` varchar(255),
  `password` varchar(255),
  `creation_date` datetime,
  `last_login_date` datetime,
  `status` varchar(255),
  `googleId` varchar(255),
  `token` varchar(255),
  `avatar` LONGTEXT NULL DEFAULT NULL
);

CREATE TABLE `roles` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255)
);

CREATE TABLE `user_role` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `role_id` integer
);

CREATE TABLE `master_tables` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `default_seats` integer,
  `status`varchar(255)
);

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


CREATE TABLE `tables` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `name` varchar(255),
  `paid` bool,
  `status` varchar(255),
  `user_id` INT NULL
);

CREATE TABLE `tables_history` (
  `history_id` integer PRIMARY KEY AUTO_INCREMENT,
  `id` integer,
  `event_id` integer,
  `name` varchar(255),
  `paid` bool,
  `status` varchar(255),
  `user_id` INT NULL,
  `archived_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

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

CREATE TABLE `events` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `date` date,
  `status` VARCHAR(255) NULL,
  `menu_id` INT NULL
);

CREATE TABLE `menu` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `creation_date` datetime,
  `status` varchar(255)
);

CREATE TABLE `orders` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `table_id` integer,
  `done` bool,
  `order_date` datetime,
  `user_id` INT NULL
);

CREATE TABLE `orders_history` (
  `history_id` integer PRIMARY KEY AUTO_INCREMENT,
  `id` integer,
  `event_id` integer,
  `table_id` integer,
  `done` bool,
  `order_date` datetime,
  `user_id` INT NULL,
  `archived_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `destinations` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `status` varchar(255),
  `minute_to_alert` INT
);

CREATE TABLE `master_items` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `price` double,
  `destination_id` integer,
  `available` bool,
  `status` varchar(255),
  `menu_id` INT NULL,
  `sub_type_id` INT NULL
);

CREATE TABLE `items` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `table_id` integer,
  `order_id` integer,
  `master_item_id` integer,
  `type` varchar(255),
  `sub_type` varchar(255),
  `sub_type_id` VARCHAR(255) NULL,
  `icon` VARCHAR(255) NULL,
  `name` VARCHAR(255),
  `price` DOUBLE,
  `note` varchar(255),
  `done` bool,
  `paid` bool,
  `destination_id` integer, 
  `menu_id` integer
);

CREATE TABLE `items_history` (
  `history_id` integer PRIMARY KEY AUTO_INCREMENT,
  `id` integer,
  `event_id` integer,
  `table_id` integer,
  `order_id` integer,
  `master_item_id` integer,
  `type` varchar(255),
  `sub_type` varchar(255),
  `sub_type_id` VARCHAR(255) NULL,
  `icon` VARCHAR(255) NULL,
  `name` VARCHAR(255),
  `price` DOUBLE,
  `note` varchar(255),
  `done` bool,
  `paid` bool,
  `destination_id` integer, 
  `menu_id` integer,
  `archived_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `audit` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `method` varchar(255),
  `path` varchar(255),
  `data` JSON,
  `dateTime` datetime
);

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
);

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

CREATE TABLE `user_event` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `event_id` integer
);

CREATE TABLE `railway`.`rooms` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(255) NULL,
  `width` DOUBLE NULL,
  `height` DOUBLE NULL,
  `status` VARCHAR(255) NULL
);

ALTER TABLE `railway`.`master_tables` 
ADD COLUMN `room_id` VARCHAR(45) NULL AFTER `status`,
ADD COLUMN `x` DOUBLE NULL AFTER `room_id`,
ADD COLUMN `y` DOUBLE NULL AFTER `x`,
ADD COLUMN `width` DOUBLE NULL AFTER `y`,
ADD COLUMN `height` DOUBLE NULL AFTER `width`,
ADD COLUMN `shape` VARCHAR(45) NULL AFTER `height`;

ALTER TABLE `user_role` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `user_role` ADD FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`);
ALTER TABLE `tables` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);
ALTER TABLE `table_master_table` ADD FOREIGN KEY (`master_table_id`) REFERENCES `master_tables` (`id`);
ALTER TABLE `table_master_table` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);
ALTER TABLE `orders` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);
ALTER TABLE `orders` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);
ALTER TABLE `audit` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `master_items` ADD FOREIGN KEY (`destination_id`) REFERENCES `destinations` (`id`);
ALTER TABLE `items` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);
ALTER TABLE `items` ADD FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);
ALTER TABLE `items` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);
ALTER TABLE `master_items` ADD FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`);
ALTER TABLE `events` ADD FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`);
ALTER TABLE `sub_types` ADD FOREIGN KEY (`type_id`) REFERENCES `types` (`id`);
ALTER TABLE `user_event` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `user_event` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);
ALTER TABLE `orders` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `tables` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

INSERT INTO users (email, username, status) VALUES ('ziro84@gmail.com', 'Superuser', 'ACTIVE');

INSERT INTO roles (name) VALUES ('admin');
INSERT INTO roles (name) VALUES ('checkout');
INSERT INTO roles (name) VALUES ('waiter');
INSERT INTO roles (name) VALUES ('bartender');
INSERT INTO roles (name) VALUES ('superuser');
INSERT INTO roles (name) VALUES ('client');

INSERT INTO user_role (user_id, role_id) VALUES (1, 1);
INSERT INTO user_role (user_id, role_id) VALUES (1, 2);
INSERT INTO user_role (user_id, role_id) VALUES (1, 3);
INSERT INTO user_role (user_id, role_id) VALUES (1, 4);
INSERT INTO user_role (user_id, role_id) VALUES (1, 5);

INSERT INTO `menu` (name, creation_date, status) VALUES ('Menu Principale', NOW(), 'ACTIVE');

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

INSERT INTO `rooms` (name, width, height) VALUES ('Sala 1', 4, 15);
INSERT INTO `rooms` (name, width, height) VALUES ('Sala 2', 5, 12);

INSERT INTO master_tables (name, default_seats, status) VALUES ('1', 6, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('2', 6, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('3', 6, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('4', 10, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('5', 4, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('6', 4, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('7', 4, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('8', 10, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('9', 6, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('10', 6, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('11', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Palco Dx', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Palco C', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Palco Sx', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Bagni Dx', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Bagni Sx', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Noire', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Bara', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Cor 1', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Cor 2', 8, 'ACTIVE');
INSERT INTO master_tables (name, default_seats, status) VALUES ('Cor 3', 8, 'ACTIVE');

UPDATE `master_tables` SET room_id = 2, height = 100, width = 100, x = 50, y = 50, shape = 'rect';
UPDATE `master_tables` SET room_id = 1 WHERE name in ('Bagni Dx','Bagni Sx','Noire','Bara','Cor 1','Cor 2','Cor 3');

INSERT INTO destinations (name, status, minute_to_alert) VALUES ('Bar Ludoteca', 'ACTIVE', 15);
INSERT INTO destinations (name, status, minute_to_alert) VALUES ('Cucina Libra', 'ACTIVE', 15);

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Valyria', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Braavos', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Moria', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Rohan', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Salem', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Durmstrang', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ("R'lyeh", 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Miskatonic', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Arrakis', 7, 6, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Caladan', 7, 6, 2, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Valyria', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Braavos', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Moria', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Rohan', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Salem', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Durmstrang', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ("R'lyeh", 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Miskatonic', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Arrakis', 8, 5, 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Caladan', 8, 5, 2, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Poretti 4 Luppoli', 1, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Brooklyn IPA', 1, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Grimbergen Double', 1, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Bottiglia 5', 1, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Bottiglia 6', 1, 6, 1, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Chinotto', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Limonata', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Gazzosa', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Aranciata', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Aranciata Amara', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Cola', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Coca Zero', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Ginger Birra', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Tonica', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Te Freddo Pesca', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Te Freddo Limone', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Succo Pera', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Succo Pesca', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Succo ACE', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Succo Ananas', 4, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Acqua Naturale', 4, 2, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Acqua Frizzante', 4, 2, 1, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Cuba Libre', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Git Tonic', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Git Lemon', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Screwdriver', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Spritz Aperol', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Spritz Campari', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Spritz Hugo', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Spritz Selec', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Negroni', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Sbagliato', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Americano', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('MiTo', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Moscow Mule', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Long Island', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Sex On The Beach', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Whisky Cola', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Tequila Sunrise', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Black Russiun', 3, 6, 1, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Cap', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Dino Sour', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Cuba di Rubik', 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ("Bee's Geek", 3, 6, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Nerv', 3, 5, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Shield Temple', 3, 5, 1, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Nachos', 6, 5, 1, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Amari/Distillati', 5, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Whisky', 5, 4, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Shot', 5, 2, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Amari/Distillati Premium', 5, 3, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Shot Premium', 5, 3, 1, 1, true, 'ACTIVE');

INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Calice di Vino', 5, 4, 1, 1, true, 'ACTIVE');
INSERT INTO master_items (name, sub_type_id, price, destination_id, menu_id, available, status) VALUES ('Bottiglia di Vino', 5, 18, 1, 1, true, 'ACTIVE');