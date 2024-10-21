CREATE TABLE `invitations` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `email` varchar(255),
  `token` varchar(255),
  `creation_date` date
);

CREATE TABLE `users` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `username` varchar(255),
  `email` varchar(255),
  `password` varchar(255),
  `creation_date` date,
  `last_login_date` date,
  `status` varchar(255),
  `googleId` varchar(255),
  `token` varchar(255)
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

CREATE TABLE `tables` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `name` varchar(255),
  `paid` bool,
  `status` varchar(255)
);

CREATE TABLE `table_master_table` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `table_id` integer,
  `master_table_id` integer
);

CREATE TABLE `events` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `date` date,
  `status` VARCHAR(255) NULL
);

CREATE TABLE `orders` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `table_id` integer,
  `done` bool,
  `order_date` datetime
);

CREATE TABLE `destinations` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `status` varchar(255)
);

CREATE TABLE `master_items` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `type` varchar(255),
  `sub_type` varchar(255),
  `price` double,
  `destination_id` integer,
  `available` bool,
  `status` varchar(255)
);

CREATE TABLE `items` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `table_id` integer,
  `order_id` integer,
  `master_item_id` integer,
  `type` varchar(255),
  `sub_type` varchar(255),
  `name` VARCHAR(255),
  `price` DOUBLE,
  `note` varchar(255),
  `done` bool,
  `paid` bool,
  `destination_id` integer
);

CREATE TABLE `audit` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `event_id` integer,
  `table_id` integer,
  `action` varchar(255),
  `actionData` JSON,
  `actionDateTime` datetime
);
ALTER TABLE `user_role` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `user_role` ADD FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`);

ALTER TABLE `tables` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `table_master_table` ADD FOREIGN KEY (`master_table_id`) REFERENCES `master_tables` (`id`);

ALTER TABLE `table_master_table` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);

ALTER TABLE `orders` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);

ALTER TABLE `orders` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `audit` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `audit` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `audit` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);

ALTER TABLE `master_items` ADD FOREIGN KEY (`destination_id`) REFERENCES `destinations` (`id`);

ALTER TABLE `items` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `items` ADD FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

ALTER TABLE `items` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);

INSERT INTO users (email, username, password) VALUES ('dan@gmail.com', 'Dan', 'password');
INSERT INTO users (email, username, password) VALUES ('ziro84@gmail.com', 'Nic', 'password');
INSERT INTO users (email, username, password) VALUES ('vi@gmail.com', 'Vi', 'password');
INSERT INTO users (email, username, password) VALUES ('elena@gmail.com', 'Elena', 'password');
INSERT INTO users (email, username, password) VALUES ('led@gmail.com', 'Led', 'password');
INSERT INTO users (email, username, password) VALUES ('ziofagiolo@gmail.com', 'Zio Fagiolo', 'password');
INSERT INTO users (email, username, password) VALUES ('titta@gmail.com', 'Titta', 'password');
INSERT INTO users (email, username, password) VALUES ('dani@gmail.com', 'Dani', 'password');

INSERT INTO roles (name) VALUES ('admin');
INSERT INTO roles (name) VALUES ('checkout');
INSERT INTO roles (name) VALUES ('waiter');
INSERT INTO roles (name) VALUES ('bartender');
INSERT INTO roles (name) VALUES ('kitchen');

INSERT INTO user_role (user_id, role_id) VALUES (1, 1);
INSERT INTO user_role (user_id, role_id) VALUES (1, 2);
INSERT INTO user_role (user_id, role_id) VALUES (1, 3);
INSERT INTO user_role (user_id, role_id) VALUES (1, 4);
INSERT INTO user_role (user_id, role_id) VALUES (1, 5);
INSERT INTO user_role (user_id, role_id) VALUES (2, 1);
INSERT INTO user_role (user_id, role_id) VALUES (2, 2);
INSERT INTO user_role (user_id, role_id) VALUES (2, 3);
INSERT INTO user_role (user_id, role_id) VALUES (3, 1);
INSERT INTO user_role (user_id, role_id) VALUES (3, 2);
INSERT INTO user_role (user_id, role_id) VALUES (4, 1);
INSERT INTO user_role (user_id, role_id) VALUES (4, 2);
INSERT INTO user_role (user_id, role_id) VALUES (4, 3);
INSERT INTO user_role (user_id, role_id) VALUES (5, 4);
INSERT INTO user_role (user_id, role_id) VALUES (5, 5);
INSERT INTO user_role (user_id, role_id) VALUES (6, 3);
INSERT INTO user_role (user_id, role_id) VALUES (7, 3);
INSERT INTO user_role (user_id, role_id) VALUES (8, 4);

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

INSERT INTO destinations (name, status) VALUES ('Bar Ludoteca', 'ACTIVE');
INSERT INTO destinations (name, status) VALUES ('Cucina Libra', 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Valyria', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Braavos', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Moria', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Rohan', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Salem', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Durmstrang', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ("R'lyeh", 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Miskatonic', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Arrakis', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Caladan', 'Cibo', 'Piadina', 6, 2, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Valyria', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Braavos', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Moria', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Rohan', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Salem', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Durmstrang', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ("R'lyeh", 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Miskatonic', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Arrakis', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Caladan', 'Cibo', 'Panino', 5, 2, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Poretti 4 Luppoli', 'Bevanda', 'Birra', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Brooklyn IPA', 'Bevanda', 'Birra', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Grimbergen Double', 'Bevanda', 'Birra', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Bottiglia 5', 'Bevanda', 'Birra', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Bottiglia 6', 'Bevanda', 'Birra', 6, 1, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Chinotto', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Limonata', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Gazzosa', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Aranciata', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Aranciata Amara', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Cola', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Coca Zero', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Ginger Birra', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Tonica', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Te Freddo Pesca', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Te Freddo Limone', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Succo Pera', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Succo Pesca', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Succo ACE', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Succo Ananas', 'Bevanda', 'Analcolico', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Acqua Naturale', 'Bevanda', 'Analcolico', 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Acqua Frizzante', 'Bevanda', 'Analcolico', 2, 1, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Cuba Libre', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Git Tonic', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Git Lemon', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Screwdriver', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Spritz Aperol', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Spritz Campari', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Spritz Hugo', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Spritz Selec', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Negroni', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Sbagliato', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Americano', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('MiTo', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Moscow Mule', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Long Island', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Sex On The Beach', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Whisky Cola', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Tequila Sunrise', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Black Russiun', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Cap', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Dino Sour', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Cuba di Rubik', 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ("Bee's Geek", 'Bevanda', 'Cocktail', 6, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Nerv', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Shield Temple', 'Bevanda', 'Cocktail', 5, 1, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Nachos', 'Cibo', 'Special', 5, 1, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Amari/Distillati', 'Bevanda', 'Extra', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Whisky', 'Bevanda', 'Extra', 4, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Shot', 'Bevanda', 'Extra', 2, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Amari/Distillati Premium', 'Bevanda', 'Extra', 3, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Shot Premium', 'Bevanda', 'Extra', 3, 1, true, 'ACTIVE');

INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Calice di Vino', 'Bevanda', 'Extra', 4, 1, true, 'ACTIVE');
INSERT INTO master_items (name, type, sub_type, price, destination_id, available, status) VALUES ('Bottiglia di Vino', 'Bevanda', 'Extra', 18, 1, true, 'ACTIVE');