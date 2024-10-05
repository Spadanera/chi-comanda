CREATE TABLE `users` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `username` varchar(255),
  `email` varchar(255),
  `password` varchar(255)
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
  `default_seats` integer
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
  `date` date
);

CREATE TABLE `orders` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `table_id` integer,
  `done` bool
);

CREATE TABLE `destinations` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `location` varchar(255)
);

CREATE TABLE `master_items` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `type` varchar(255),
  `sub_type` varchar(255),
  `price` double,
  `destination_id` integer,
  `available` bool
);

CREATE TABLE `items` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `table_id` integer,
  `order_id` integer,
  `master_item_id` integer,
  `note` varchar(255),
  `done` bool,
  `paid` bool
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

CREATE TABLE `workers` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `event_id` integer,
  `user_id` integer
);

ALTER TABLE `user_role` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `user_role` ADD FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`);

ALTER TABLE `tables` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `table_master_table` ADD FOREIGN KEY (`master_table_id`) REFERENCES `master_tables` (`id`);

ALTER TABLE `table_master_table` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);

ALTER TABLE `orders` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);

ALTER TABLE `orders` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `workers` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `workers` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `audit` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `audit` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `audit` ADD FOREIGN KEY (`table_id`) REFERENCES `tables` (`id`);

ALTER TABLE `items` ADD FOREIGN KEY (`master_item_id`) REFERENCES `master_items` (`id`);

ALTER TABLE `master_items` ADD FOREIGN KEY (`destination_id`) REFERENCES `destinations` (`id`);

ALTER TABLE `items` ADD FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

ALTER TABLE `items` ADD FOREIGN KEY (`table_id`) REFERENCES `events` (`id`);
