-- Total Clear
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE items;
DROP TABLE orders;
DROP TABLE master_items;
DROP TABLE destinations;
DROP TABLE table_master_table;
DROP TABLE tables;
DROP TABLE master_tables;
DROP TABLE events;
DROP TABLE user_role;
DROP TABLE roles;
DROP TABLE users;
DROP TABLE audit;
SET FOREIGN_KEY_CHECKS = 1;

-- Working clear
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE items;
TRUNCATE TABLE orders;
TRUNCATE TABLE tables;
TRUNCATE TABLE events;
TRUNCATE TABLE table_master_table;
SET FOREIGN_KEY_CHECKS = 1;