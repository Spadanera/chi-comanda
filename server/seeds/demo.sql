-- Demo data for local development and tests (rooms, tables, destinations, products and a superuser).
-- Applied only when DEMO_SEED=true and the baseline has just created an empty database. Never on client installations.

INSERT INTO users (email, username, status) VALUES ('ziro84@gmail.com', 'Superuser', 'ACTIVE');
INSERT INTO user_role (user_id, role_id) VALUES (1, 1);
INSERT INTO user_role (user_id, role_id) VALUES (1, 2);
INSERT INTO user_role (user_id, role_id) VALUES (1, 3);
INSERT INTO user_role (user_id, role_id) VALUES (1, 4);
INSERT INTO user_role (user_id, role_id) VALUES (1, 5);

INSERT INTO `rooms` (name, width, height, status) VALUES ('Sala 1', 4, 15, 'ACTIVE');
INSERT INTO `rooms` (name, width, height, status) VALUES ('Sala 2', 5, 12, 'ACTIVE');

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

