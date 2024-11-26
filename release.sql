USE railway;

SET SQL_SAFE_UPDATES = 0;

CREATE TABLE `broadcast` (
  `id` integer UNIQUE PRIMARY KEY AUTO_INCREMENT,
  `user_id` integer,
  `message` varchar(255),
  `date_time` datetime,
  `receivers` varchar(255)
);

SET SQL_SAFE_UPDATES = 1;