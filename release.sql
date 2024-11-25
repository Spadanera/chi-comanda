USE railway;

SET SQL_SAFE_UPDATES = 0;

CREATE TABLE `payment_providers` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `display_name` varchar(255),
  `creation_date` datetime,
  `type` varchar(255),
  `is_default` bool,
  `status` varchar(255),
  `access_info` varchar(255)
);

CREATE TABLE `transactions` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `date_time` datetime,
  `payment_provider_id` INT,
  `payment_provider_type` varchar(255),
  `payment_provider_info` varchar(255)
);

ALTER TABLE `items` 
ADD COLUMN `transaction_id` INT NULL AFTER `destination_id`;

SET SQL_SAFE_UPDATES = 1;