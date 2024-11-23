USE railway;

SET SQL_SAFE_UPDATES = 0;

CREATE TABLE `payment_providers` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `creation_date` datetime,
  `type` varchar(255),
  `status` varchar(255),
  `access_info` varchar(255)
);

CREATE TABLE `transactions` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `name` varchar(255),
  `date_time` datetime,
  `provider` varchar(255),
  `providerInfo` varchar(255)
);

SET SQL_SAFE_UPDATES = 1;