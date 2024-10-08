INSERT INTO users (email, username, password) VALUES ('dan@gmail.com', 'Dan', 'password');
INSERT INTO users (email, username, password) VALUES ('ziro84@gmail.com', 'Nic', 'password');
INSERT INTO users (email, username, password) VALUES ('vi@gmail.com', 'Vi', 'password');
INSERT INTO users (email, username, password) VALUES ('elena@gmail.com', 'Elena', 'password');
INSERT INTO users (email, username, password) VALUES ('led@gmail.com', 'Led', 'password');
INSERT INTO users (email, username, password) VALUES ('ziofagiolo@gmail.com', 'Zio Fagiolo', 'password');
INSERT INTO users (email, username, password) VALUES ('titta@gmail.com', 'Titta', 'password');
INSERT INTO users (email, username, password) VALUES ('dani@gmail.com', 'Dani', 'password');

INSERT INTO roles (name) VALUES ('Admin');
INSERT INTO roles (name) VALUES ('Checkout');
INSERT INTO roles (name) VALUES ('Waiter');
INSERT INTO roles (name) VALUES ('Bartender');
INSERT INTO roles (name) VALUES ('Cook');

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

INSERT INTO master_tables (name, default_seats) VALUES ('1', 6);
INSERT INTO master_tables (name, default_seats) VALUES ('2', 6);
INSERT INTO master_tables (name, default_seats) VALUES ('3', 6);
INSERT INTO master_tables (name, default_seats) VALUES ('4', 10);
INSERT INTO master_tables (name, default_seats) VALUES ('5', 4);
INSERT INTO master_tables (name, default_seats) VALUES ('6', 4);
INSERT INTO master_tables (name, default_seats) VALUES ('7', 4);
INSERT INTO master_tables (name, default_seats) VALUES ('8', 10);
INSERT INTO master_tables (name, default_seats) VALUES ('9', 6);
INSERT INTO master_tables (name, default_seats) VALUES ('10', 6);
INSERT INTO master_tables (name, default_seats) VALUES ('11', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('12', 8);

INSERT INTO destinations (name, location) VALUES ('LUDO-BAR', 'DOWN');
INSERT INTO destinations (name, location) VALUES ('LUDO-KITCHEN', 'DOWN');
INSERT INTO destinations (name, location) VALUES ('LIBRA-KITCHEN', 'UP');

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Coca Cola', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Fanta', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Sprite', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Acqua', 'BEVERAGE', 'SOFT-DRINK', 2, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Cuba Libre', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Git Tonic', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Margarita', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Long Island', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Bionda', 'BEVERAGE', 'BEER', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Rossa', 'BEVERAGE', 'BEER', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Scura', 'BEVERAGE', 'BEER', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Rhum', 'BEVERAGE', 'SPIRIT', 8, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Whisky', 'BEVERAGE', 'SPIRIT', 8, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Gin', 'BEVERAGE', 'SPIRIT', 8, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Nachos', 'FOOD', 'EXTRA', 5, 2);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Pippo', 'FOOD', 'PANINO', 8, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Pluto', 'FOOD', 'PANINO', 8, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Paperino', 'FOOD', 'PANINO', 8, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Minni', 'FOOD', 'PIADINA', 8, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Topolino', 'FOOD', 'PIADINA', 8, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Zio Paperone', 'FOOD', 'PIADINA', 8, 3);

INSERT INTO events (name, date, status) VALUES ('First event', '2024-10-19', 'ONGOING')