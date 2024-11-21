USE railway;

SET SQL_SAFE_UPDATES = 0;

CREATE TABLE `user_event` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `event_id` integer
);

ALTER TABLE `user_event` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
ALTER TABLE `user_event` ADD FOREIGN KEY (`event_id`) REFERENCES `events` (`id`);

ALTER TABLE `orders` 
ADD COLUMN `user_id` INT NULL DEFAULT NULL AFTER `order_date`;

ALTER TABLE `orders` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

ALTER TABLE `tables` 
ADD COLUMN `user_id` INT NULL DEFAULT NULL AFTER `status`;

ALTER TABLE `tables` ADD FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

SET SQL_SAFE_UPDATES = 1;