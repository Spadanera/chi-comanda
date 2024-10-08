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
INSERT INTO master_tables (name, default_seats) VALUES ('Palco Dx', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Palco C', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Palco Sx', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Bagni Dx', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Bagni Sx', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Noire', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Bara', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Cor 1', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Cor 2', 8);
INSERT INTO master_tables (name, default_seats) VALUES ('Cor 3', 8);

INSERT INTO destinations (name, location) VALUES ('LUDO-BAR', 'DOWN');
INSERT INTO destinations (name, location) VALUES ('LUDO-KITCHEN', 'DOWN');
INSERT INTO destinations (name, location) VALUES ('LIBRA-KITCHEN', 'UP');

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Valyria', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Braavos', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Moria', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Rohan', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Salem', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Durmstrang', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ("R'lyeh", 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Miskatonic', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Arrakis', 'FOOD', 'PIADINA', 6, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Caladan', 'FOOD', 'PIADINA', 6, 3);

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Valyria', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Braavos', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Moria', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Rohan', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Salem', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Durmstrang', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ("R'lyeh", 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Miskatonic', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Arrakis', 'FOOD', 'PANINO', 5, 3);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Caladan', 'FOOD', 'PANINO', 5, 3);

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Poretti 4 Luppoli', 'BEVERAGE', 'BEER', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Brooklyn IPA', 'BEVERAGE', 'BEER', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Grimbergen Double', 'BEVERAGE', 'BEER', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Bottiglia 5', 'BEVERAGE', 'BEER', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Bottiglia 6', 'BEVERAGE', 'BEER', 6, 1);

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Chinotto', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Limonata', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Gazzosa', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Aranciata', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Aranciata Amara', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Cola', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Coca Zero', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Ginger Beer', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Tonica', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Te Freddo Pesca', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Te Freddo Limone', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Succo Pera', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Succo Pesca', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Succo ACE', 'BEVERAGE', 'SOFT-DRINK', 3, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Succo Ananas', 'BEVERAGE', 'SOFT-DRINK', 3, 1);

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Cuba Libre', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Git Tonic', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Git Lemon', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Screwdriver', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Spritz Aperol', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Spritz Campari', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Spritz Hugo', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Spritz Selec', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Negroni', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Sbagliato', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Americano', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('MiTo', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Moscow Mule', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Long Island', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Sex On The Beach', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Whisky Cola', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Tequila Sunrise', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Black Russiun', 'BEVERAGE', 'COCKTAIL', 6, 1);

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Cap', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Dino Sour', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Cuba di Rubik', 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ("Bee's Geek", 'BEVERAGE', 'COCKTAIL', 6, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Nerv', 'BEVERAGE', 'COCKTAIL', 5, 1);
INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Shield Temple', 'BEVERAGE', 'COCKTAIL', 5, 1);

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Nachos', 'FOOD', 'EXTRA', 5, 2);

INSERT INTO master_items (name, type, sub_type, price, destination_id) VALUES ('Amari', 'BEVERAGE', 'SPIRIT', 5, 2);



INSERT INTO events (name, date, status) VALUES ('First event', '2024-10-19', 'ONGOING')