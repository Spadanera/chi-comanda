USE railway;

-- Notifiche push dei nuovi ordini per i bartender (v1.18)
-- Si può rieseguire senza errori.

-- Preferenza dell'utente: NULL = mai chiesto, 1 = vuole le notifiche, 0 = non le vuole
SET @exists := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'push_orders');
SET @sql := IF(@exists = 0, 'ALTER TABLE `users` ADD COLUMN `push_orders` TINYINT(1) NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Destinazione (bar, cucina...) del bartender nella serata: riceve le notifiche solo per quella.
-- NULL per i lavoranti che non sono al bar e per le serate create prima di questa versione.
SET @exists := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'user_event' AND column_name = 'destination_id');
SET @sql := IF(@exists = 0, 'ALTER TABLE `user_event` ADD COLUMN `destination_id` INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Un'iscrizione per ogni dispositivo/browser su cui l'utente le ha attivate
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `endpoint` VARCHAR(512) NOT NULL,
  `p256dh` VARCHAR(255) NOT NULL,
  `auth` VARCHAR(255) NOT NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_endpoint` (`endpoint`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `push_subscriptions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

-- Pagamenti elettronici chiusi dal server (v1.19): la transazione ricorda cosa paga.
-- full = chiude il tavolo, partial = paga solo gli item in item_ids.
SET @exists := (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'payment_transactions' AND column_name = 'mode');
SET @sql := IF(@exists = 0, "ALTER TABLE `payment_transactions` ADD COLUMN `mode` VARCHAR(10) NOT NULL DEFAULT 'full' AFTER `status`", 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
