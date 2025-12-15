USE railway;

SET SQL_SAFE_UPDATES = 0;

CREATE TABLE `tables_history` (
  `history_id` integer PRIMARY KEY AUTO_INCREMENT,
  `id` integer,
  `event_id` integer,
  `name` varchar(255),
  `paid` bool,
  `status` varchar(255),
  `user_id` INT NULL,
  `archived_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

INSERT INTO items_history (
      id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id, menu_id
    )
    SELECT 
      id, event_id, table_id, order_id, master_item_id, type, sub_type, sub_type_id, icon, name, price, note, done, paid, destination_id, menu_id
    FROM items;

DELETE FROM items;

INSERT INTO orders_history (id, event_id, table_id, done, order_date, user_id)
     SELECT id, event_id, table_id, done, order_date, user_id
     FROM orders;

DELETE FROM orders;

INSERT INTO tables_history (id, event_id, name, paid, status, user_id)
       SELECT id, event_id, name, paid, status, user_id 
       FROM tables;

TRUNCATE TABLE table_master_table;

DELETE FROM tables;

ALTER TABLE `railway`.`table_master_table` 
DROP FOREIGN KEY `table_master_table_ibfk_2`;
ALTER TABLE `railway`.`table_master_table` 
DROP PRIMARY KEY,
ADD PRIMARY KEY (`master_table_id`);
;
ALTER TABLE `railway`.`table_master_table` 
ADD CONSTRAINT `table_master_table_ibfk_2`
  FOREIGN KEY (`master_table_id`)
  REFERENCES `railway`.`master_tables_event` (`id`);

SET SQL_SAFE_UPDATES = 1;