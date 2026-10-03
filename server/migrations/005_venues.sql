-- Multi-venue (docs/multi-venue.md): every domain row belongs to a venue. The existing data goes into venue 1.
-- `venue_id` comes with DEFAULT 1, so the previous release keeps writing valid rows; the default is dropped later.
-- Composite FKs (venue_id, x_id) -> parent (venue_id, id) replace the existing single-column ones: the database refuses
-- a row of one venue pointing to a row of another. FKs that don't exist today come in a later migration, after an
-- orphan check on the production data (a failing migration stops the server).

CREATE TABLE IF NOT EXISTS `venues` (
  `id` INT NOT NULL AUTO_INCREMENT,
  -- NULL = the installation's CLIENT_NAME (only the venue created here)
  `name` VARCHAR(100) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  -- NULL = every feature of the installation (FEATURES); otherwise a JSON array, intersected with FEATURES
  `features` JSON NULL,
  -- PNG, 512x512
  `logo` MEDIUMBLOB NULL,
  `primary_color` CHAR(7) NULL,
  `secondary_color` CHAR(7) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `venues_status` CHECK (`status` IN ('ACTIVE', 'DISABLED'))
);

-- The branding set so far moves to venue 1; `settings` stays for the previous release and is dropped later
INSERT INTO `venues` (`id`, `name`, `logo`, `primary_color`, `secondary_color`)
SELECT 1, `venue_name`, `logo`, `primary_color`, `secondary_color` FROM `settings` WHERE `id` = 1;
INSERT IGNORE INTO `venues` (`id`) VALUES (1);

-- ── Roots of the catalogue and of the layout ────────────────────────────────

ALTER TABLE `menu`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `menu_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

ALTER TABLE `destinations`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `destinations_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

ALTER TABLE `types`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `types_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

ALTER TABLE `rooms`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `rooms_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

ALTER TABLE `sub_types`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `sub_types_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `sub_types_ibfk_1`,
  ADD CONSTRAINT `sub_types_type` FOREIGN KEY (`venue_id`, `type_id`) REFERENCES `types` (`venue_id`, `id`);

ALTER TABLE `master_items`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `master_items_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `master_items_ibfk_1`,
  DROP FOREIGN KEY `master_items_ibfk_2`,
  ADD CONSTRAINT `master_items_destination` FOREIGN KEY (`venue_id`, `destination_id`) REFERENCES `destinations` (`venue_id`, `id`),
  ADD CONSTRAINT `master_items_menu` FOREIGN KEY (`venue_id`, `menu_id`) REFERENCES `menu` (`venue_id`, `id`);

ALTER TABLE `master_tables`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `master_tables_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `master_tables_ibfk_1`,
  ADD CONSTRAINT `master_tables_room` FOREIGN KEY (`venue_id`, `room_id`) REFERENCES `rooms` (`venue_id`, `id`);

-- ── Events and what happens during them ─────────────────────────────────────

ALTER TABLE `events`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `events_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `events_ibfk_1`,
  ADD CONSTRAINT `events_menu` FOREIGN KEY (`venue_id`, `menu_id`) REFERENCES `menu` (`venue_id`, `id`);

ALTER TABLE `master_tables_event`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `master_tables_event_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `master_tables_event_ibfk_1`,
  ADD CONSTRAINT `master_tables_event_event` FOREIGN KEY (`venue_id`, `event_id`) REFERENCES `events` (`venue_id`, `id`);

ALTER TABLE `tables`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `tables_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `tables_ibfk_1`,
  ADD CONSTRAINT `tables_event` FOREIGN KEY (`venue_id`, `event_id`) REFERENCES `events` (`venue_id`, `id`);

ALTER TABLE `orders`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD UNIQUE KEY `uk_venue_id` (`venue_id`, `id`),
  ADD CONSTRAINT `orders_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `orders_ibfk_1`,
  DROP FOREIGN KEY `orders_ibfk_2`,
  ADD CONSTRAINT `orders_table` FOREIGN KEY (`venue_id`, `table_id`) REFERENCES `tables` (`venue_id`, `id`),
  ADD CONSTRAINT `orders_event` FOREIGN KEY (`venue_id`, `event_id`) REFERENCES `events` (`venue_id`, `id`);

ALTER TABLE `items`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `items_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `items_ibfk_1`,
  DROP FOREIGN KEY `items_ibfk_2`,
  DROP FOREIGN KEY `items_ibfk_3`,
  ADD CONSTRAINT `items_event` FOREIGN KEY (`venue_id`, `event_id`) REFERENCES `events` (`venue_id`, `id`),
  ADD CONSTRAINT `items_order` FOREIGN KEY (`venue_id`, `order_id`) REFERENCES `orders` (`venue_id`, `id`),
  ADD CONSTRAINT `items_table` FOREIGN KEY (`venue_id`, `table_id`) REFERENCES `tables` (`venue_id`, `id`);

ALTER TABLE `user_event`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `user_event_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  DROP FOREIGN KEY `user_event_ibfk_2`,
  ADD CONSTRAINT `user_event_event` FOREIGN KEY (`venue_id`, `event_id`) REFERENCES `events` (`venue_id`, `id`);

ALTER TABLE `table_master_table`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `table_master_table_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

-- Archived rows keep no FK to their (deleted) parents
ALTER TABLE `items_history`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `items_history_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

ALTER TABLE `orders_history`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `orders_history_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

ALTER TABLE `tables_history`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `tables_history_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

-- ── Payments ────────────────────────────────────────────────────────────────

ALTER TABLE `payment_settings`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `payment_settings_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  ADD UNIQUE KEY `uk_venue_provider` (`venue_id`, `provider`),
  DROP INDEX `uk_provider`;

ALTER TABLE `payment_transactions`
  ADD COLUMN `venue_id` INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT `payment_transactions_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

-- ── Audit and roles: NULL is the platform ───────────────────────────────────

-- Every action recorded so far happened in venue 1
ALTER TABLE `audit`
  ADD COLUMN `venue_id` INT NULL DEFAULT 1,
  ADD CONSTRAINT `audit_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

ALTER TABLE `user_role`
  ADD COLUMN `venue_id` INT NULL DEFAULT 1,
  ADD CONSTRAINT `user_role_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`);

-- The superuser belongs to the platform, not to a venue
UPDATE `user_role` SET `venue_id` = NULL WHERE `role_id` = (SELECT `id` FROM `roles` WHERE `name` = 'superuser');

-- Exact duplicates (same user, venue and role) mean nothing; drop them before the unique key
DELETE dup FROM `user_role` dup
INNER JOIN `user_role` keep
  ON keep.`user_id` = dup.`user_id` AND keep.`role_id` = dup.`role_id`
  AND keep.`venue_id` <=> dup.`venue_id` AND keep.`id` < dup.`id`;

ALTER TABLE `user_role` ADD UNIQUE KEY `uk_user_venue_role` (`user_id`, `venue_id`, `role_id`);
